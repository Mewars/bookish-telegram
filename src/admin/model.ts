import { isSafeWebUrl } from '../organizations/model';
import type { OrganizationRow } from '../organizations/model';

export type AdminRole = 'owner' | 'editor';
export type AdminStatus = 'draft' | 'published' | 'archived';

export interface CityAdminAccess {
  user_id: string;
  city: string;
  role: AdminRole;
  active: boolean;
}

export interface AdminDraft {
  id: string;
  city: string;
  title: string;
  category: string;
  description: string;
  address: string;
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

export function newAdminDraft(city: string): AdminDraft {
  return { id: '', city, title: '', category: '', description: '', address: '', phone: '',
    hours: '', website: '', vk_url: '', source_url: '', image_url: '', status: 'draft', verified_at: '' };
}

export function rowToAdminDraft(row: OrganizationRow): AdminDraft {
  return {
    id: row.id, city: row.city, title: row.title, category: row.category,
    description: row.description, address: row.address ?? '', phone: row.phone ?? '',
    hours: row.hours ?? '', website: row.website ?? '', vk_url: row.vk_url ?? '',
    source_url: row.source_url ?? '', image_url: row.image_url ?? '',
    status: row.status, verified_at: row.verified_at ?? '',
  };
}

export function validateAdminDraft(draft: AdminDraft, confirmed: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.city.trim() || draft.city.length > 100) errors.city = 'Выбери город.';
  for (const { key, label, limit, required } of adminFields) {
    const value = draft[key].trim();
    if (required && !value) errors[key] = `Заполни поле «${label}».`;
    else if (value.length > limit) errors[key] = `Не более ${limit} символов.`;
    else if (/\p{Cc}/u.test(value.replace(/[\r\n\t]/g,''))) errors[key] = 'Недопустимые символы.';
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
