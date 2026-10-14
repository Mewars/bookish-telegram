import type { SupabaseClient } from '@supabase/supabase-js';
import { adminImageExtension, prepareAdminImage, validPhotoFile } from '../photos/adminImage';

export const CLASSIFIED_PHOTO_BUCKET='ryadom-classified-photos';
export const CLASSIFIED_PHOTO_LIMIT=10;
export interface ClassifiedPhoto {
  id:string;listing_id:string;slot:number;format:'webp'|'jpg';object_path:string;
}
export interface VisiblePhoto extends ClassifiedPhoto { url:string; }

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function db(client:SupabaseClient|null):SupabaseClient {
  if(!client)throw Error('Тестовое хранилище фотографий не подключено.');
  return client;
}
export function nextPhotoSlot(items:Pick<ClassifiedPhoto,'slot'>[]):number|null{
  const slots=new Set(items.map(photo=>photo.slot));
  for(let slot=0;slot<CLASSIFIED_PHOTO_LIMIT;slot++)if(!slots.has(slot))return slot;
  return null;
}
export function photoKey(listingId:string,id:string,format:'webp'|'jpg'):string {
  if(!uuidPattern.test(listingId)||!uuidPattern.test(id))throw Error('Неверный идентификатор фотографии.');
  return listingId+'/'+id+'.'+format;
}
export function assertPhotoBatch(files:File[],existing:number):void {
  if(!files.length)throw Error('Выберите хотя бы одну фотографию.');
  if(existing+files.length>CLASSIFIED_PHOTO_LIMIT)
    throw Error('В одном объявлении можно разместить не более 10 фотографий.');
  if(files.some(file=>!validPhotoFile(file)))
    throw Error('Фотографии должны быть JPG, PNG, WebP или HEIC до 24 МБ каждая.');
}
export async function listClassifiedPhotos(client:SupabaseClient|null,listingId:string):Promise<ClassifiedPhoto[]> {
  const {data,error}=await db(client).from('classified_photos')
    .select('id,listing_id,slot,format,object_path').eq('listing_id',listingId).order('slot');
  if(error)throw Error('Не удалось получить фотографии объявления.');
  return (data??[]) as ClassifiedPhoto[];
}
// Private bucket: only authors, assigned pending moderators and viewers of published
// listings can sign photographs. Never construct a public Storage URL.
export async function signedClassifiedPhotos(client:SupabaseClient|null,photos:ClassifiedPhoto[]):Promise<VisiblePhoto[]>{
  const storage=db(client).storage.from(CLASSIFIED_PHOTO_BUCKET);
  const signed=await Promise.all(photos.map(async photo=>{
    const {data,error}=await storage.createSignedUrl(photo.object_path,600);
    return !error && data?.signedUrl?{...photo,url:data.signedUrl}:null;
  }));
  return signed.filter((photo):photo is VisiblePhoto=>photo!==null);
}
// Reserve a DB row before upload: Storage RLS only permits objects whose
// canonical path is already registered on this owner's editable draft.
export async function uploadClassifiedPhotos(client:SupabaseClient|null,listingId:string,files:File[]):Promise<void> {
  const c=db(client);
  const slots=await listClassifiedPhotos(c,listingId);
  assertPhotoBatch(files,slots.length);
  const occupied=[...slots];
  for(const file of files){
    const slot=nextPhotoSlot(occupied);
    if(slot===null)throw Error('Достигнут лимит фотографий.');
    const blob=await prepareAdminImage(file,'gallery'); // strips EXIF and GPS by canvas re-encoding
    const format=adminImageExtension(blob);
    const id=crypto.randomUUID();
    const path=photoKey(listingId,id,format);
    const {data,error}=await c.from('classified_photos')
      .insert({id,listing_id:listingId,slot,format})
      .select('id,listing_id,slot,format,object_path').single();
    if(error || !data || data.object_path!==path)
      throw Error('Не удалось зарезервировать место для фотографии.');
    const {error:uploadError}=await c.storage.from(CLASSIFIED_PHOTO_BUCKET).upload(path,blob,{
      contentType:blob.type,cacheControl:'3600',upsert:false,
    });
    if(uploadError){
      const {error:cleanupError}=await c.from('classified_photos').delete().eq('id',id);
      if(cleanupError)throw Error('Загрузка не выполнена, и зарезервированное место не удалось освободить. Попробуйте позже.');
      throw Error('Не удалось загрузить фотографию. Попробуйте ещё раз.');
    }
    occupied.push(data as ClassifiedPhoto);
  }
}
export async function deleteClassifiedPhoto(client:SupabaseClient|null,photo:ClassifiedPhoto):Promise<void>{
  const c=db(client);
  if(photoKey(photo.listing_id,photo.id,photo.format)!==photo.object_path)
    throw Error('Некорректный путь фотографии.');
  const {error:storageError}=await c.storage.from(CLASSIFIED_PHOTO_BUCKET).remove([photo.object_path]);
  if(storageError)throw Error('Не удалось удалить файл фотографии.');
  const {data,error}=await c.from('classified_photos').delete().eq('id',photo.id)
    .eq('listing_id',photo.listing_id).select('id');
  if(error||!data?.length)throw Error('Файл удалён, но запись фотографии не обновилась. Повторите удаление.');
}
