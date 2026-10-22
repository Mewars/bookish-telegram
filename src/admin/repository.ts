import type { SupabaseClient } from '@supabase/supabase-js';
import { isSafeWebUrl } from '../organizations/model';
import type { OrganizationRow,ApplicationRow } from '../organizations/model';
import { ORGANIZATION_COLUMNS, APPLICATION_COLUMNS, withDeadline } from '../organizations/repository';
import { canManageCity, nextAvailabilityStatus,validateAdminDraft, type AdminDraft, type CityAdminAccess } from './model';
import { prepareAdminImage, adminImageExtension } from '../photos/adminImage';
import { storageAdminPhotoKey } from './storagePaths';

const BUCKET = 'ryadom-places';
const ADMIN_COLUMNS = ORGANIZATION_COLUMNS;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export async function deleteAdminOrganization(client:SupabaseClient,userId:string,access:CityAdminAccess[],row:OrganizationRow):Promise<void>{
 await requireCurrentUser(client,userId);
 if(!canManageCity(access,row.city))throw Error('Нет прав для удаления этой организации.');
 const {data,error}=await withDeadline(signal=>client.rpc('delete_organization',{
  p_id:row.id,p_city:row.city,p_expected_updated_at:row.updated_at,
 }).abortSignal(signal));
 if(error||data!==row.id)throw Error('Удаление не подтверждено. Возможно, карточку изменили или права доступа обновились. Обнови список перед повтором.');
}

async function requireCurrentUser(client: SupabaseClient, expectedUserId: string) {
  const { data, error } = await withDeadline(() => client.auth.getUser());
  if (error || !data.user || data.user.id !== expectedUserId) throw new Error('Сессия истекла. Войди снова.');
}

export async function readCityAccess(client: SupabaseClient, userId: string): Promise<CityAdminAccess[]> {
  await requireCurrentUser(client, userId);
  const { data, error } = await withDeadline(signal => client.from('city_admin_access')
    .select('user_id,city,role,active').eq('user_id', userId).eq('active', true).abortSignal(signal));
  if (error || !Array.isArray(data)) throw new Error('Администраторский доступ пока не настроен.');
  return (data as CityAdminAccess[]).filter(row => row.user_id === userId && row.active);
}

export async function readAdminOrganizations(client: SupabaseClient, userId: string, access: CityAdminAccess[]): Promise<OrganizationRow[]> {
  await requireCurrentUser(client, userId);
  if (!access.length) throw new Error('Нет разрешения на управление организациями.');
  const rows: OrganizationRow[] = [];
  const owner=access.some(entry=>entry.active&&entry.city==='*'&&entry.role==='owner');
  const cities=access.filter(entry=>entry.active&&entry.city!=='*').map(entry=>entry.city);
  for (let offset = 0; offset < 10000; offset += 250) {
    const { data, error } = await withDeadline(signal => {
      let query=client.from('organizations').select(ADMIN_COLUMNS).order('title').order('id').range(offset,offset+249).abortSignal(signal);
      if(!owner)query=query.in('city',cities);
      return query;
    });
    if (error || !Array.isArray(data)) throw new Error('Не удалось получить организации.');
    rows.push(...(data as OrganizationRow[]).filter(row => canManageCity(access, row.city)));
    if (data.length < 250) return rows;
  }
  throw new Error('Каталог слишком большой. Нужна постраничная загрузка.');
}

function normalizedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export async function saveAdminOrganization(client: SupabaseClient, userId: string, access: CityAdminAccess[], draft: AdminDraft, confirmed: boolean): Promise<OrganizationRow> {
  await requireCurrentUser(client, userId);
  if (!canManageCity(access, draft.city)) throw new Error('У тебя нет доступа к этому городу.');
  if (draft.status === 'published' && !confirmed) throw new Error('Сначала подтверди проверку данных перед публикацией.');
  for (const key of ['website', 'vk_url', 'source_url', 'image_url'] as const) {
    if (draft[key].trim() && !isSafeWebUrl(draft[key].trim())) throw new Error('Ссылка должна начинаться с HTTPS.');
  }
  const verifiedAt = draft.status === 'published' ? new Date().toISOString().slice(0, 10) : normalizedOrNull(draft.verified_at);
  const values = {
    title: draft.title.trim(), category: draft.category.trim(), description: draft.description.trim(),
    address: normalizedOrNull(draft.address),
    latitude: draft.latitude.trim() ? Number(draft.latitude.trim().replace(',', '.')) : null,
    longitude: draft.longitude.trim() ? Number(draft.longitude.trim().replace(',', '.')) : null,
    phone: normalizedOrNull(draft.phone),
    hours: normalizedOrNull(draft.hours), website: normalizedOrNull(draft.website), vk_url: normalizedOrNull(draft.vk_url),
    source_url: normalizedOrNull(draft.source_url), image_url: normalizedOrNull(draft.image_url),
    source_type: confirmed ? 'manual_verified' : 'user_provided', verified_at: verifiedAt,
    status: draft.status,
  };
  const request = draft.id
    ? client.from('organizations').update(values).eq('id', draft.id).eq('city', draft.city)
    : client.from('organizations').insert({ ...values, kind: draft.kind, city: draft.city, id: `${draft.kind === 'services' ? 'service' : 'place'}-${crypto.randomUUID()}` });
  const { data, error } = await withDeadline(signal => request.select(ADMIN_COLUMNS).abortSignal(signal).single());
  if (error || !data) throw new Error('Сохранение не подтверждено. Проверь список карточек и права доступа, прежде чем повторять.');
  return data as OrganizationRow;
}

/**
 * Immediately removes a closed business from the public directory without
 * deleting its history or images. Restore always returns it to an unpublished
 * draft, requiring a separate review before it can be republished.
 *
 * Checks actual session and server-side RLS; a suspended editor cannot archive
 * another city's listing, even by calling the API directly.
 */
export async function changeAdminOrganizationAvailability(
  client: SupabaseClient,
  userId: string,
  access: CityAdminAccess[],
  row: OrganizationRow,
): Promise<OrganizationRow> {
  await requireCurrentUser(client, userId);
  if (!canManageCity(access, row.city)) throw new Error('Нет прав для управления этой организацией.');
  const target = nextAvailabilityStatus(row.status);
  const { data, error } = await withDeadline(signal => client.from('organizations')
    .update({ status: target })
    .eq('id', row.id).eq('city', row.city).eq('status', row.status)
    .select(ADMIN_COLUMNS).abortSignal(signal).single());
  if (error || !data) throw new Error('Статус не изменился. Возможно, карточку уже обновили или права доступа изменились. Обнови админку.');
  return data as OrganizationRow;
}

export async function uploadAdminPhoto(client: SupabaseClient, userId: string, access: CityAdminAccess[], city: string, file: File): Promise<{ url: string; path: string }> {
  await requireCurrentUser(client, userId);
  if (!canManageCity(access, city)) throw new Error('Нет доступа к загрузке фотографий этого города.');
  // Automatically crop the cover to 16:9 and optimize it before sending any bytes.
  const optimized = await prepareAdminImage(file, 'cover');
  if (!optimized.size || optimized.size > MAX_IMAGE_BYTES) throw new Error('Фотография после обработки превышает 2 МБ. Выбери изображение меньшего размера.');
  const key = storageAdminPhotoKey(city, crypto.randomUUID(), adminImageExtension(optimized));
  const { error } = await client.storage.from(BUCKET).upload(key, optimized, { contentType: optimized.type, upsert: false, cacheControl: '31536000' });
  if (error) {
    const status = String(error.statusCode ?? '');
    if (status === '403' || status === '401') throw new Error('Хранилище не разрешило загрузку. Проверь, что ты вошёл через VK ID с правами администратора.');
    if (error.message && /InvalidKey|Invalid key/i.test(error.message))
      throw new Error('Недопустимый адрес фотографии в хранилище. Обнови страницу и попробуй ещё раз.');
    if (status === '413') throw new Error('Размер фото превышает ограничение хранилища.');
    if (status === '415') throw new Error('Хранилище не принимает этот формат фотографии.');
    throw new Error(`Ошибка загрузки фотографии (${status || 'сеть'}). Попробуй ещё раз.`);
  }
  const { data } = client.storage.from(BUCKET).getPublicUrl(key);
  if (!isSafeWebUrl(data.publicUrl)) throw new Error('Хранилище вернуло некорректный адрес фотографии.');
  return {url: data.publicUrl, path: key};
}

/** Remove an orphaned uploaded file when saving the card itself fails. */
export async function removeOrphanedAdminPhoto(client: SupabaseClient, path: string): Promise<void> {
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw new Error('Не удалось очистить временно загруженную фотографию.');
}

/** Reviewers can read only pending requests from their assigned city, enforced by RLS. */
export async function readPendingAdminApplications(client:SupabaseClient,userId:string,access:CityAdminAccess[]):Promise<ApplicationRow[]>{
 await requireCurrentUser(client,userId);
 if(!access.length)throw Error('Нет доступа к заявкам.');
 const rows:ApplicationRow[]=[];
 for(let offset=0;offset<5000;offset+=100){
   const {data,error}=await withDeadline(signal=>client.from('organization_applications')
     .select(APPLICATION_COLUMNS).eq('status','pending').order('created_at',{ascending:false})
     .range(offset,offset+99).abortSignal(signal));
   if(error||!Array.isArray(data))throw Error('Не удалось получить заявки на добавление организаций.');
   rows.push(...(data as ApplicationRow[]).filter(row=>canManageCity(access,row.city)));
   if(data.length<100)return rows;
 }
 throw Error('Слишком много заявок, требуется постраничная обработка.');
}

export async function downloadApplicantPhoto(client:SupabaseClient,userId:string,access:CityAdminAccess[],app:ApplicationRow):Promise<File|null>{
 await requireCurrentUser(client,userId);
 if(!canManageCity(access,app.city))throw Error('Нет доступа к фотографии этой заявки.');
 if(!app.photo_path)return null;
 const prefix=`${app.applicant_id}/${app.id}/`;
 if(!app.photo_path.startsWith(prefix)||!/\.(jpg|webp)$/.test(app.photo_path))throw Error('Неверный путь фотографии.');
 const {data,error}=await client.storage.from('ryadom-org-requests').download(app.photo_path);
 if(error||!data)throw Error('Не удалось прочитать закрытую фотографию заявки.');
 return new File([data],app.photo_path.endsWith('.jpg')?'request.jpg':'request.webp',
   {type:app.photo_path.endsWith('.jpg')?'image/jpeg':'image/webp'});
}

/** Atomic server-side decision: a reviewed draft becomes a published card or remains pending. */
export async function decideOrganizationApplication(client:SupabaseClient,userId:string,access:CityAdminAccess[],
 app:ApplicationRow, decision:'approved'|'rejected',draft?:AdminDraft,confirmed=false,reason=''):Promise<OrganizationRow|null>{
 await requireCurrentUser(client,userId);
 if(!canManageCity(access,app.city))throw Error('Нет прав на рассмотрение заявки из этого города.');
 if(app.status!=='pending')throw Error('Эта заявка уже рассмотрена.');
 if(decision==='rejected'&&reason.trim().length<10)throw Error('Укажите причину отказа (не менее 10 символов).');
 if(decision==='approved'){
   if(!draft||draft.city!==app.city||draft.id||draft.status!=='published'||!confirmed)
     throw Error('Нужно проверить сведения организации, подтвердить публикацию и сохранить.');
   const errors=validateAdminDraft(draft,confirmed);
   if(Object.keys(errors).length)throw Error(Object.values(errors)[0]);
 }
 const reviewed=draft?{
   ...draft, title:draft.title.trim(),city:app.city,category:draft.category.trim(),
   description:draft.description.trim(),status:'published',
 }:null;
 const {data,error}=await withDeadline(signal=>client.rpc('review_organization_request',{
   p_application_id:app.id,p_decision:decision,p_reviewed_fields:decision==='approved'?reviewed:null,
   p_message:reason.trim()||null,
 }).abortSignal(signal));
 if(error||typeof data!=='string')throw Error('Решение не подтверждено сервером. Обновите список заявок перед повтором.');
 if(decision==='rejected')return null;
 const {data:organization,error:readError}=await withDeadline(signal=>client.from('organizations')
   .select(ADMIN_COLUMNS).eq('id',data).abortSignal(signal).single());
 if(readError||!organization)throw Error('Заявка одобрена, но карточка не загрузилась. Обновите список, не отправляйте решение повторно.');
 return organization as OrganizationRow;
}
