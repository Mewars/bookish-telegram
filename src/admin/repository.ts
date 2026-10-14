import type { SupabaseClient } from '@supabase/supabase-js';
import { isSafeWebUrl } from '../organizations/model';
import type { OrganizationRow } from '../organizations/model';
import { ORGANIZATION_COLUMNS, withDeadline } from '../organizations/repository';
import { canManageCity, type AdminDraft, type CityAdminAccess } from './model';
import { prepareAdminImage, adminImageExtension } from '../photos/adminImage';
import { storageAdminPhotoKey } from './storagePaths';

const BUCKET = 'ryadom-places';
const ADMIN_COLUMNS = ORGANIZATION_COLUMNS;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

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
  for (let offset = 0; offset < 10000; offset += 250) {
    const { data, error } = await withDeadline(signal => client.from('organizations')
      .select(ADMIN_COLUMNS).order('title').order('id').range(offset, offset + 249).abortSignal(signal));
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
    address: normalizedOrNull(draft.address), phone: normalizedOrNull(draft.phone),
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
