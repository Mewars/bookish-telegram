import type { SupabaseClient } from '@supabase/supabase-js';
import type { Item } from '../types';
import { withDeadline } from '../organizations/repository';

export const CARD_PHOTO_BUCKET = 'ryadom-card-photos';
export const CARD_PHOTO_CITY = 'Енисейск';
const MAX_INPUT_BYTES = 24 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const PHOTO_PATH = /^eniseysk\/(?:place|service)-[a-z0-9-]{1,100}\/[a-f0-9-]{36}\.webp$/;
const CARD_ID = /^(?:place|service)-[a-z0-9-]{1,100}$/;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export interface DirectoryPhotoRow {
  card_id: string;
  city: string;
  storage_path: string;
  updated_at: string;
}

export function validCardPhotoId(id: string): boolean {
  return CARD_ID.test(id);
}

export function validCardPhotoPath(path: string): boolean {
  return PHOTO_PATH.test(path);
}

export function publicCardPhotoUrl(client: SupabaseClient, path: string): string | undefined {
  if (!validCardPhotoPath(path)) return;
  const { data } = client.storage.from(CARD_PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl.startsWith('https://') ? data.publicUrl : undefined;
}

export async function readDirectoryPhotos(client: SupabaseClient | null): Promise<DirectoryPhotoRow[]> {
  if (!client) throw new Error('Supabase не настроен.');
  const { data, error } = await withDeadline(signal => client.from('directory_card_photos')
    .select('card_id,city,storage_path,updated_at')
    .eq('city', CARD_PHOTO_CITY).order('card_id').abortSignal(signal));
  if (error || !Array.isArray(data)) throw new Error('Фотографии временно недоступны.');
  return (data as DirectoryPhotoRow[]).filter(row => validCardPhotoId(row.card_id) && validCardPhotoPath(row.storage_path) && row.city === CARD_PHOTO_CITY);
}

export function applyDirectoryPhotos(items: Item[], rows: DirectoryPhotoRow[], client: SupabaseClient | null): Item[] {
  if (!client || !rows.length) return items;
  const photoById = new Map(rows.map(row => [row.card_id, row]));
  return items.map(item => {
    if (item.city !== CARD_PHOTO_CITY || item.kind === 'events') return item;
    const photo = photoById.get(item.id);
    if (!photo) return item;
    const url = publicCardPhotoUrl(client, photo.storage_path);
    if (!url) return item;
    return { ...item, image: url, photoIllustrative: false, photoCredit: undefined,
      photoSourceUrl: undefined, photoLicenseUrl: undefined };
  });
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать фотографию. Сохрани её в JPG или PNG и попробуй снова.')); };
    img.src = url;
  });
}

// Convert large phone photos locally and strip EXIF/GPS metadata.
// Only the resulting compressed WEBP is sent to Supabase.
export async function prepareDirectoryPhoto(file: File): Promise<Blob> {
  const ext = file.name.toLocaleLowerCase('en-US').split('.').pop();
  const supported = IMAGE_TYPES.has(file.type.toLocaleLowerCase('en-US')) ||
    ((!file.type || file.type === 'application/octet-stream') && ['jpg','jpeg','png','webp','heic','heif'].includes(ext ?? ''));
  if (!supported || !file.size || file.size > MAX_INPUT_BYTES)
    throw new Error('Выбери изображение JPG, PNG, WebP или HEIC размером до 24 МБ.');
  const img = await loadImage(file);
  if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 65_000_000)
    throw new Error('Слишком большое изображение. Уменьши его и попробуй снова.');
  const scale = Math.min(1, 1600 / img.naturalWidth, 1200 / img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Этот браузер не смог подготовить фотографию.');
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
  canvas.width = 0; canvas.height = 0;
  if (!blob || blob.type !== 'image/webp' || blob.size > MAX_OUTPUT_BYTES)
    throw new Error('Не удалось сжать фотографию. Попробуй JPG или PNG меньшего размера.');
  return blob;
}

async function requireUser(client: SupabaseClient, expectedId: string) {
  const { data, error } = await withDeadline(() => client.auth.getUser());
  if (error || data.user?.id !== expectedId) throw new Error('Авторизация истекла. Войди снова.');
}

export async function uploadDirectoryPhoto(client: SupabaseClient, expectedUserId: string, item: Item, file: File): Promise<DirectoryPhotoRow> {
  if (item.city !== CARD_PHOTO_CITY || item.kind === 'events' || !validCardPhotoId(item.id))
    throw new Error('Невозможно загрузить фото для этой карточки.');
  await requireUser(client, expectedUserId);
  const optimized = await prepareDirectoryPhoto(file);
  const path = `eniseysk/${item.id}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await client.storage.from(CARD_PHOTO_BUCKET)
    .upload(path, optimized, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
  if (uploadError) throw new Error('Не удалось загрузить фото. Проверь права администратора и хранилище.');
  const { data, error } = await withDeadline(signal => client.from('directory_card_photos')
    .upsert({card_id: item.id, city: CARD_PHOTO_CITY, storage_path: path}, { onConflict:'card_id' })
    .select('card_id,city,storage_path,updated_at').abortSignal(signal).single());
  if (error || !data) {
    // An unattached photo must never appear in the directory; best-effort cleanup.
    await client.storage.from(CARD_PHOTO_BUCKET).remove([path]);
    throw new Error('Фотография загрузилась, но не привязалась к карточке. Попробуй ещё раз.');
  }
  return data as DirectoryPhotoRow;
}

export async function removeDirectoryPhoto(client: SupabaseClient, expectedUserId: string, row: DirectoryPhotoRow): Promise<void> {
  await requireUser(client, expectedUserId);
  if (!validCardPhotoId(row.card_id) || !validCardPhotoPath(row.storage_path)) throw new Error('Неверная карточка.');
  const { data, error } = await withDeadline(signal => client.from('directory_card_photos')
    .delete().eq('card_id', row.card_id).eq('storage_path', row.storage_path)
    .select('card_id').abortSignal(signal).maybeSingle());
  if (error || !data) throw new Error('Не удалось удалить фотографию из карточки.');
  // The database no longer references this object; cleanup is best effort.
  await client.storage.from(CARD_PHOTO_BUCKET).remove([row.storage_path]);
}
