import { isSafeWebUrl } from '../organizations/model';
import type { OrganizationRow } from '../organizations/model';

export type AdminRole = 'owner' | 'editor';
export type AdminStatus = 'draft' | 'published' | 'archived';

/** Closing a place is reversible, but reopening requires separate review. */
export function nextAvailabilityStatus(current: AdminStatus): 'archived' | 'draft' {
  return current === 'archived' ? 'draft' : 'archived';
}


export interface CityAdminAccess {
  user_id: string;
  city: string;
  role: AdminRole;
  active: boolean;
}

export interface AdminDraft {
  id: string;
  city: string;
  kind: 'places' | 'services';
  title: string;
  category: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  phone: string;
  hours: string;
  website: string;
  vk_url: string;
  source_url: string;
  image_url: string;
  status: AdminStatus;
  verified_at: string;
}

export const adminFields = [
  { key: 'title', label: 'Название', limit: 160, required: true },
  { key: 'category', label: 'Категория', limit: 100, required: true },
  { key: 'description', label: 'Описание', limit: 2000, required: true },
  { key: 'address', label: 'Адрес', limit: 300 },
  { key: 'latitude', label: 'Широта (карта)', limit: 30 },
  { key: 'longitude', label: 'Долгота (карта)', limit: 30 },
  { key: 'phone', label: 'Телефон', limit: 40 },
  { key: 'hours', label: 'Часы работы', limit: 300 },
  { key: 'website', label: 'Сайт', limit: 500 },
  { key: 'vk_url', label: 'ВКонтакте', limit: 500 },
  { key: 'source_url', label: 'Ссылка на источник информации', limit: 500 },
] as const;

export type AdminField = typeof adminFields[number]['key'];

export function canManageCity(access: CityAdminAccess[], city: string): boolean {
  return access.some(entry => entry.active && (entry.city === city || (entry.city === '*' && entry.role === 'owner')));
}

/** Owner may start a listing in a newly registered but still empty city.
 * Editors see only explicitly assigned cities, even if the public city
 * directory contains others. Server-side RLS remains authoritative.
 */
export function manageableAdminCities(
  access: CityAdminAccess[],
  organizationCities: readonly string[],
  directoryCities: readonly string[],
): string[] {
  const owner = access.some(entry => entry.active && entry.city === '*' && entry.role === 'owner');
  const candidates = owner
    ? [...directoryCities, ...organizationCities]
    : access.filter(entry => entry.active && entry.city !== '*').map(entry => entry.city);
  return [...new Set(candidates.filter(city => city.length > 0 && canManageCity(access, city)))]
    .sort((a, b) => a.localeCompare(b, 'ru'));
}

export function newAdminDraft(city: string): AdminDraft {
  return { id: '', city, kind: 'places', title: '', category: '', description: '', address: '', latitude: '', longitude: '', phone: '',
    hours: '', website: '', vk_url: '', source_url: '', image_url: '', status: 'draft', verified_at: '' };
}

export function rowToAdminDraft(row: OrganizationRow): AdminDraft {
  return {
    id: row.id, city: row.city, kind: row.kind === 'services' ? 'services' : 'places', title: row.title, category: row.category,
    description: row.description, address: row.address ?? '',
    latitude: row.latitude == null ? '' : String(row.latitude),
    longitude: row.longitude == null ? '' : String(row.longitude), phone: row.phone ?? '',
    hours: row.hours ?? '', website: row.website ?? '', vk_url: row.vk_url ?? '',
    source_url: row.source_url ?? '', image_url: row.image_url ?? '',
    status: row.status, verified_at: row.verified_at ?? '',
  };
}

export function validateAdminDraft(draft: AdminDraft, confirmed: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.city.trim() || draft.city.length > 100) errors.city = 'Выбери город.';
  if (!['places', 'services'].includes(draft.kind)) errors.kind = 'Выбери тип организации.';
  for (const field of adminFields) {
    const { key, label, limit } = field;
    const value = draft[key].trim();
    if ('required' in field && field.required && !value) errors[key] = `Заполни поле «${label}».`;
    else if (value.length > limit) errors[key] = `Не более ${limit} символов.`;
    else if (/\p{Cc}/u.test(value.replace(/[\r\n\t]/g,''))) errors[key] = 'Недопустимые символы.';
  }
  // Coordinates are optional but must be a complete and valid WGS84 pair.
  const hasLatitude = draft.latitude.trim() !== '';
  const hasLongitude = draft.longitude.trim() !== '';
  if (hasLatitude !== hasLongitude) errors.latitude = 'Для отметки на карте укажи широту и долготу вместе.';
  if (hasLatitude && hasLongitude) {
    const decimal = /^-?\d+(?:[.,]\d+)?$/;
    const lat = Number(draft.latitude.trim().replace(',', '.'));
    const lon = Number(draft.longitude.trim().replace(',', '.'));
    if (!decimal.test(draft.latitude.trim()) || !Number.isFinite(lat) || Math.abs(lat) > 90)
      errors.latitude = 'Широта должна быть от -90 до 90.';
    if (!decimal.test(draft.longitude.trim()) || !Number.isFinite(lon) || Math.abs(lon) > 180)
      errors.longitude = 'Долгота должна быть от -180 до 180.';
  }
  if (draft.phone.trim() && !/^[+\d\s().-]{5,40}$/.test(draft.phone.trim())) errors.phone = 'Проверь номер телефона.';
  for (const key of ['website', 'vk_url', 'source_url', 'image_url'] as const) {
    const url = draft[key].trim();
    if (url && (!isSafeWebUrl(url) || new URL(url).href.length > (key === 'image_url' ? 1000 : 500))) errors[key] = 'Нужна безопасная HTTPS-ссылка.';
  }
  if (draft.vk_url && isSafeWebUrl(draft.vk_url) && !['vk.com', 'www.vk.com', 'vk.ru', 'www.vk.ru'].includes(new URL(draft.vk_url).hostname)) errors.vk_url = 'Нужна ссылка vk.com или vk.ru.';
  if (draft.status === 'published' && !confirmed) errors.confirmed = 'Подтверди, что проверил достоверность и право на публикацию.';
  return errors;
}
