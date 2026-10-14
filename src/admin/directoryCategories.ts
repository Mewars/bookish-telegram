import type { OrganizationRow } from '../organizations/model';

// A presentation taxonomy for the existing free-text organization.category column.
// Do not create or migrate production database columns until a verified backup exists.
export const directoryCategories = [
  { id: 'food', label: 'Где поесть', value: 'Кафе', kind: 'places', color: '#FE9556', path: 'M4 3v8m4-8v8M2 3v4m2 4v10M12 3v7c0 2 1 3 3 3v8M20 3c-2 1-3 4-3 8h3V3z' },
  { id: 'hotel', label: 'Отели', value: 'Гостиницы', kind: 'places', color: '#9279FF', path: 'M3 19v-9m0 4h18v5M3 17h18M6 10V6h5v4M14 11V7h5v4' },
  { id: 'groceries', label: 'Продукты', value: 'Продукты', kind: 'places', color: '#61A8E9', path: 'M3 7h18l-2 13H5L3 7zm4-3 3 3m7-3-3 3M7 11v5m5-5v5m5-5v5' },
  { id: 'pharmacy', label: 'Аптеки', value: 'Аптеки', kind: 'services', color: '#8ABF53', path: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z' },
  { id: 'museum', label: 'Музеи', value: 'Музеи', kind: 'places', color: '#52B7A2', path: 'm2 9 10-6 10 6M3 9h18M5 10v9m5-9v9m5-9v9m5-9v9M2 21h20' },
  { id: 'landmark', label: 'Достопримечательности', value: 'Достопримечательности', kind: 'places', color: '#6F9DDF', path: 'M3 20h18M7 16v4M17 16v4M5 10l7-7 7 7M6 10h12v6H6z' },
  { id: 'culture', label: 'Культура', value: 'Культура', kind: 'places', color: '#C17EE2', path: 'M4 4h16v16H4zM9 3v5m6-5v5M8 13h8m-8 4h6' },
  { id: 'library', label: 'Библиотеки', value: 'Библиотеки', kind: 'places', color: '#78A5D0', path: 'M3 4c4-1 7 0 9 2v15c-2-2-5-3-9-2V4zm9 2c3-2 6-3 9-2v15c-4-1-7 0-9 2' },
  { id: 'park', label: 'Парки и прогулки', value: 'Парки / Прогулки', kind: 'places', color: '#82B97E', path: 'm12 3-7 9h4l-5 6h16l-5-6h4l-7-9zm0 15v4' },
  { id: 'services', label: 'Госуслуги', value: 'Госуслуги', kind: 'services', color: '#A6A9AE', path: 'M5 4h14v17H5zm4 4h6m-6 4h6m-6 4h4' },
  { id: 'mail', label: 'Почта', value: 'Почта', kind: 'services', color: '#648ECA', path: 'M3 5h18v14H3V5zm0 2 9 7 9-7' },
  { id: 'fuel', label: 'АЗС', value: 'АЗС', kind: 'places', color: '#353E4B', path: 'M4 3h11v18H4V3zm2 4h7v5H6m9-4 4 4v7a2 2 0 0 0 4 0v-8l-3-4' },
  { id: 'shop', label: 'Торговые центры', value: 'Торговые центры', kind: 'places', color: '#61A8E9', path: 'M5 9h14v12H5zM3 9l2-6h14l2 6m-18 0a3 3 0 0 0 6 0m0 0a3 3 0 0 0 6 0m0 0a3 3 0 0 0 6 0' },
  { id: 'bank', label: 'Банкоматы', value: 'Банкоматы', kind: 'services', color: '#A88AFF', path: 'M12 2v20M17 6h-7a4 4 0 0 0 0 8h4a4 4 0 0 1 0 8H7' },
  { id: 'car', label: 'Автосервисы', value: 'Автосервисы', kind: 'services', color: '#9F8CF2', path: 'm5 12 2-7h10l2 7M4 12h16v8H4zM7 20v2m10-2v2M8 16h2m4 0h2' },
  { id: 'beauty', label: 'Салоны красоты', value: 'Салоны красоты', kind: 'services', color: '#EF81AE', path: 'M4 5c0 5 9 6 12 10a4 4 0 1 1-3 3L4 5zm16 0L7 18' },
  { id: 'health', label: 'Больницы', value: 'Больницы', kind: 'services', color: '#EB79AA', path: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z' },
  { id: 'sport', label: 'Спорт', value: 'Спорт', kind: 'places', color: '#9982FF', path: 'M3 9v6m3-9v12m12-12v12m3-9v6M6 10h12v4H6z' },
  { id: 'general', label: 'Другое', value: 'Другое', kind: 'places', color: '#778B9A', path: 'M12 2v20M2 12h20' },
] as const;

export type DirectoryCategoryId = typeof directoryCategories[number]['id'];
export function categoryForOrganization(item: Pick<OrganizationRow, 'category'>): DirectoryCategoryId {
  const value = item.category.toLocaleLowerCase('ru');
  if (/музе|рубано/.test(value)) return 'museum';
  if (/кафе|пицц|ресторан|столов|пекар|бургер|суши|еда|где поесть/.test(value)) return 'food';
  if (/гостиниц|отел|хостел/.test(value)) return 'hotel';
  if (/аптек/.test(value)) return 'pharmacy';
  if (/продукт|супермаркет|магазин продуктов/.test(value)) return 'groceries';
  if (/библиотек/.test(value)) return 'library';
  if (/достопримеч|памятник/.test(value)) return 'landmark';
  if (/парки|парк|прогулк/.test(value)) return 'park';
  if (/культур|дом культуры/.test(value)) return 'culture';
  if (/госуслуг|мфц/.test(value)) return 'services';
  if (/почт/.test(value)) return 'mail';
  if (/автосервис|ремонт авто|шиномонтаж/.test(value)) return 'car';
  if (/азс|заправк/.test(value)) return 'fuel';
  if (/торгов|тц|магазины/.test(value)) return 'shop';
  if (/банкомат/.test(value)) return 'bank';
  if (/красот|парикмах|салон/.test(value)) return 'beauty';
  if (/больниц|поликлиник|клиник/.test(value)) return 'health';
  if (/спорт|фитнес|зал/.test(value)) return 'sport';
  return 'general';
}
