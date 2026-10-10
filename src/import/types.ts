export const sourceTypes = {
  owner_provided: 'данные предоставлены владельцем/представителем',
  official_website: 'официальный сайт организации',
  official_social: 'официальная страница организации',
  government_open_data: 'официальный набор открытых государственных данных',
  manual_verified: 'данные собраны и проверены вручную из допустимых источников',
} as const;
export type OrganizationSourceType = keyof typeof sourceTypes;
export interface SourceMetadata {
  sourceUrl?: string;
  sourceType?: string;
  verifiedAt?: string;
  updatedAt?: string;
}
export interface OrganizationImportRecord extends SourceMetadata {
  title: string;
  city: string;
  category: string;
  sourceUrl: string;
  sourceType: OrganizationSourceType;
  address?: string;
  phone?: string;
  hours?: string;
  website?: string;
  vkUrl?: string;
  description?: string;
  coordinates?: { lat: number; lon: number };
}
export const importFields = [
  ['title', 'Название'], ['city', 'Город'], ['category', 'Категория'],
  ['address', 'Адрес'], ['phone', 'Телефон'], ['hours', 'Часы'],
  ['website', 'Сайт'], ['vkUrl', 'VK'], ['description', 'Описание'],
  ['lat', 'Широта'], ['lon', 'Долгота'], ['sourceUrl', 'Источник'],
  ['sourceType', 'Тип источника'], ['verifiedAt', 'Дата проверки'],
] as const;
export type ImportField = typeof importFields[number][0];
export type OrganizationDraft = Record<ImportField, string>;
export interface ImportRow {
  number: number;
  draft: OrganizationDraft;
  structuralErrors: string[];
}
export interface CheckedRow extends ImportRow {
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  status: 'ready' | 'warning' | 'error';
}
