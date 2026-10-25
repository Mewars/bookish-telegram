import type { Item, Kind } from '../types';
import { reviewedEvents } from './events';
import { places } from './places';
import { verifiedEniseyskPlaces, verifiedEniseyskServices } from './verifiedEniseysk';

export const categories: Record<Kind, string[]> = {
 events: ['Все', 'Вечеринки', 'Концерты', 'Кино', 'Спорт', 'Мероприятия', 'Другое'],
 places: ['Все', 'Кафе', 'Музеи', 'Достопримечательности', 'Парки', 'Культура', 'Библиотеки', 'Гостиницы'],
 services: ['Все', 'Госуслуги', 'Почта', 'Красота', 'Авто', 'Ремонт', 'Доставка', 'Обучение', 'Фото/видео', 'Другое'],
};

// Published baseline: user-supplied places and researched directory entries with source links.
// Reviewed events carry fixed dates and owner-supplied posters.
export const catalog: Item[] = [...places, ...verifiedEniseyskPlaces, ...verifiedEniseyskServices, ...reviewedEvents];

export const sectionTitles: Record<Kind, string> = { events: 'Афиша', places: 'Места', services: 'Услуги' };
