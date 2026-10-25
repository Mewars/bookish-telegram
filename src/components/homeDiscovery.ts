import type { Item } from '../types';

const leadingCategory = (item: Pick<Item, 'category'>): string =>
  item.category.toLocaleLowerCase('ru').split('/')[0].trim();
const matchesAny = (value: string, fragments: string[]) => fragments.some(part => value.includes(part));

/** Eating out and prepared food. Grocery shopping has a separate destination. */
export function isFoodVenue(item: Item): boolean {
  const category = leadingCategory(item);
  return matchesAny(category, ['кафе', 'ресторан', 'пицц', 'кофейн', 'столов', 'бургер', 'пекар', 'фастфуд', 'суши', 'готовая еда', 'доставка еды', 'кондитер', 'еда и напитки']);
}

/** Museums, monuments, architecture, religious landmarks and cultural spaces. */
export function isCulturalPlace(item: Item): boolean {
  if (item.kind !== 'places') return false;
  const category = leadingCategory(item);
  return matchesAny(category, ['музе', 'культур', 'истори', 'достопримечательност', 'памятник', 'театр', 'кино', 'библиотек', 'церк', 'храм', 'собор', 'монастыр', 'архитектур', 'галере', 'парк', 'набережн', 'прогулк']);
}

/** Grocery shopping belongs to 'Магазины', not the 'Поесть' shortcut. */
export function isGroceryStore(item: Item): boolean {
  const category = item.category.toLocaleLowerCase('ru');
  return matchesAny(category, [
    'продукт', 'супермаркет', 'гипермаркет', 'гастроном',
    'бакале', 'продовольств', 'овощ', 'фрукт', 'мясная лавка', 'рыбная лавка',
  ]);
}

export function isShop(item: Item): boolean {
  const category = leadingCategory(item);
  return isGroceryStore(item) || matchesAny(category, ['магазин', 'продукт', 'супермаркет', 'гипермаркет', 'универмаг', 'торгов', 'маркет', 'цвет', 'одежд', 'обув', 'электроник', 'бытовая техник', 'товары для дома', 'аптек', 'книжн', 'оптик', 'зоотовар']);
}

/** Repair, public services, finance, beauty etc., not retail and not prepared food. */
export function isService(item: Item): boolean {
  return item.kind === 'services' && !isShop(item) && !isFoodVenue(item);
}

const WEEKDAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'] as const;
const SHORT_DAYS = ['вс','пн','вт','ср','чт','пт','сб'] as const;

function weekdayIndex(word: string): number {
  const normalized = word.trim().toLocaleLowerCase('ru');
  const index = WEEKDAYS.findIndex(day => day === normalized);
  return index >= 0 ? index : SHORT_DAYS.findIndex(day => day === normalized);
}
function inRange(day: number, first: number, last: number): boolean {
  return first <= last ? day >= first && day <= last : day >= first || day <= last;
}

/**
 * Describes a POSSIBLE visit today from a documented weekly schedule,
 * not live opening status. Bare opening hours without days are not enough.
 */
export function hasDeclaredScheduleToday(hours: string | undefined, day: number): boolean {
  if (!hours || !Number.isInteger(day) || day < 0 || day > 6) return false;
  const value = hours.toLocaleLowerCase('ru').replace(/ё/g, 'е');
  if (/временно закрыт|не работает|закрыто|до особого распоряжения/.test(value)) return false;
  if (!/\d{1,2}[:.]\d{2}/.test(value)) return false;
  if (/ежедневно|каждый день|без выходных|круглосуточно/.test(value)) return true;
  const dayName = '(?:воскресенье|понедельник|вторник|среда|четверг|пятница|суббота|вс|пн|вт|ср|чт|пт|сб)';
  const range = new RegExp(`(${dayName})\\s*[–—-]\\s*(${dayName})`, 'g');
  let match: RegExpExecArray | null;
  let hasRanges = false;
  while ((match = range.exec(value)) !== null) {
    hasRanges = true;
    if (inRange(day, weekdayIndex(match[1]), weekdayIndex(match[2]))) return true;
  }
  // When a weekday range is present, never infer that a weekday mentioned
  // separately (for example "понедельник — выходной") is an opening day.
  if (hasRanges) return false;
  // Explicit single weekdays are valid too.
  const dayWords: string[] = value.match(new RegExp(`\\b(?:пн|вт|ср|чт|пт|сб|вс)\\b`, 'g')) ?? [];
  if (dayWords.includes(SHORT_DAYS[day])) return true;
  return WEEKDAYS.some((name,index) => index === day && value.includes(name));
}

export function weekdayInCity(date: Date, timeZone = 'Asia/Krasnoyarsk'): number {
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(date);
  return (['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const).indexOf(day as 'Sun');
}

export function isTodayRecommendation(item: Item): boolean {
  // Today is an events agenda, never a directory of businesses that might be open.
  return item.kind === 'events' && item.dateOffset === 0;
}

export const EDITORIAL_ENISEYSK_IDS = [
  'place-spassky-monastery',
  'place-kytmanov-museum',
  'place-borodkin-house',
  'place-photoizba',
  'place-plane-museum',
  'place-monastery-park',
  'place-founders-monument',
] as const;

export function editorialPicks(items: Item[], city: string): Item[] {
  if (city !== 'Енисейск') return [];
  return EDITORIAL_ENISEYSK_IDS.flatMap(id => {
    const entry = items.find(item => item.id === id && item.kind === 'places');
    return entry ? [entry] : [];
  });
}
