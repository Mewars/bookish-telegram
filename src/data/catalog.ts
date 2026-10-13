import type { Item, Kind } from '../types';
import { places } from './places';

export const categories: Record<Kind, string[]> = {
 events: ['Все', 'Вечеринки', 'Концерты', 'Кино', 'Спорт', 'Мероприятия', 'Другое'],
 places: ['Все', 'Кафе', 'Музеи', 'Достопримечательности', 'Парки'],
 services: ['Все', 'Красота', 'Авто', 'Ремонт', 'Доставка', 'Обучение', 'Фото/видео', 'Другое'],
};

// Only the ten supplied real places are published. Do not invent events or service providers.
export const catalog: Item[] = [...places];

export const sectionTitles: Record<Kind, string> = { events: 'Афиша', places: 'Места', services: 'Услуги' };
