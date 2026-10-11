import type { Item } from '../types';

export const APPLICATION_CONSENT_VERSION = 'ORG-APPLICATION-1.0';
export const applicationFields = [
  ['title', 'Название организации', 160, true], ['city', 'Город', 100, true],
  ['category', 'Категория', 100, true], ['address', 'Адрес', 300, true],
  ['phone', 'Телефон организации', 40, false], ['hours', 'Режим работы', 300, false],
  ['description', 'Описание', 2000, true], ['website', 'Сайт', 500, false],
  ['vk_url', 'Страница VK', 500, false], ['source_note', 'Источник информации', 1000, true],
] as const;
export type ApplicationField = typeof applicationFields[number][0];
export type ApplicationDraft = Record<ApplicationField, string>;
export type ApplicationErrors = Partial<Record<ApplicationField | 'consent', string>>;
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export const statusLabels: Record<ApplicationStatus, string> = {
  pending: 'На рассмотрении', approved: 'Одобрена', rejected: 'Отклонена',
};
export interface OrganizationRow {
  id: string; city: string; title: string; category: string; description: string;
  address: string | null; phone: string | null; hours: string | null;
  website: string | null; vk_url: string | null; latitude: number | null; longitude: number | null;
  source_type: string; source_url: string | null; verified_at: string | null;
  status: 'draft' | 'published' | 'archived'; created_at: string; updated_at: string;
}
export interface ApplicationRow extends ApplicationDraft {
  id: string; applicant_id: string; client_request_id: string; status: ApplicationStatus;
  created_at: string; review_message: string | null; organization_id: string | null;
}
export function emptyDraft(city: string): ApplicationDraft {
  return Object.fromEntries(applicationFields.map(([key]) => [key, key === 'city' ? city : ''])) as ApplicationDraft;
}
export function isSafeWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
export function normalizeDraft(draft: ApplicationDraft): ApplicationDraft {
  return Object.fromEntries(applicationFields.map(([key]) => {
    const value = draft[key].trim();
    return [key, ['website', 'vk_url'].includes(key) && value && isSafeWebUrl(value) ? new URL(value).href : value];
  })) as ApplicationDraft;
}
export function validateDraft(draft: ApplicationDraft, consent: boolean): ApplicationErrors {
  const errors: ApplicationErrors = {};
  for (const [key, label, limit, required] of applicationFields) {
    const value = draft[key].trim();
    if (required && !value) errors[key] = `Заполните поле «${label}».`;
    else if (value.length > limit) errors[key] = `Не более ${limit} символов.`;
    else if (/\p{Cc}/u.test(value.replace(/[\n\r\t]/g, ''))) errors[key] = 'Удалите управляющие символы.';
  }
  if (draft.phone.trim() && !/^[+\d\s().-]{5,40}$/.test(draft.phone.trim())) errors.phone = 'Укажите телефон цифрами, с допустимыми +, пробелами, скобками и дефисами.';
  for (const key of ['website', 'vk_url'] as const) {
    const value = draft[key].trim();
    if (value && !isSafeWebUrl(value)) errors[key] = 'Укажите полный HTTPS-адрес без логина и пароля.';
    else if (value && new URL(value).href.length > 500) errors[key] = 'Адрес после URL-кодирования должен быть не длиннее 500 символов.';
  }
  if (draft.vk_url.trim() && isSafeWebUrl(draft.vk_url.trim()) && !['vk.com', 'www.vk.com', 'vk.ru', 'www.vk.ru'].includes(new URL(draft.vk_url.trim()).hostname)) errors.vk_url = 'Укажите адрес страницы на vk.com или vk.ru.';
  if (!consent) errors.consent = 'Для отправки необходимо отдельное согласие на обработку данных заявки.';
  return errors;
}
export function featureEnabled(flag: string | undefined, protocol: string, hostname: string, development: boolean): boolean {
  return flag === 'true' && (protocol === 'https:' || (development && ['localhost', '127.0.0.1', '[::1]'].includes(hostname)));
}
const naturalKey = (item: Pick<Item, 'city' | 'title' | 'address'>) => [item.city, item.title, item.address ?? ''].map(value => value.trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ')).join('\u0000');

// Keep local IDs and illustrations, including when a legacy place is found by name/address.
export function mergePublished(local: Item[], rows: OrganizationRow[], fallbackImage: string): Item[] {
  const result = [...local];
  const seenIds = new Set<string>();
  for (const row of rows) {
    if (row.status !== 'published' || !row.id || !row.city?.trim() || !row.title?.trim() || !row.category?.trim() || !row.description?.trim() || seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    const key = naturalKey({ city: row.city, title: row.title, address: row.address ?? undefined });
    const index = result.findIndex(item => item.kind === 'places' && (item.id === row.id || naturalKey(item) === key));
    // Never replace another kind's ID or duplicate an already merged remote record.
    if (index < 0 && result.some(item => item.id === row.id)) continue;
    const existing = index >= 0 ? result[index] : undefined;
    const coordinates = typeof row.latitude === 'number' && typeof row.longitude === 'number' && Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && Math.abs(row.latitude) <= 90 && Math.abs(row.longitude) <= 180 ? { lat: row.latitude, lon: row.longitude } : undefined;
    const item: Item = {
      ...existing, id: existing?.id ?? row.id, city: row.city, kind: 'places', real: true,
      title: row.title, category: row.category, description: row.description,
      image: existing?.image ?? fallbackImage, address: row.address ?? undefined,
      phone: row.phone ?? undefined, hours: row.hours ?? undefined, coordinates,
      website: row.website && isSafeWebUrl(row.website) ? row.website : undefined,
      vkUrl: row.vk_url && isSafeWebUrl(row.vk_url) ? row.vk_url : undefined,
      sourceType: row.source_type, sourceUrl: row.source_url && isSafeWebUrl(row.source_url) ? row.source_url : undefined,
      verifiedAt: row.verified_at ?? undefined, updatedAt: row.updated_at,
    };
    if (index >= 0) result[index] = item; else result.push(item);
  }
  return result;
}
