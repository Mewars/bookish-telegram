import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isFoodVenue, isGroceryStore, isCulturalPlace, isShop, isService,
  hasDeclaredScheduleToday, isTodayRecommendation,
  weekdayInCity, editorialPicks,
} from '../src/components/homeDiscovery.ts';
const item = (kind, category, overrides = {}) => ({
  id: 'test', city: 'Енисейск', kind, category, title:'Тест', image:'', description:'Тест', ...overrides,
});

test('food, culture, shopping and services do not mix their primary categories', () => {
  assert.equal(isFoodVenue(item('places','Кафе')), true);
  assert.equal(isFoodVenue(item('places','Пекарни / Хлеб')), true);
  assert.equal(isFoodVenue(item('services','Доставка еды')), true);
  assert.equal(isFoodVenue(item('places','Продуктовые магазины')), false);
  // Food and groceries are separate shortcuts, as specified by the product owner.
  assert.equal(isFoodVenue(item('places','Супермаркет')), false);
  assert.equal(isFoodVenue(item('places','Магазины / Продукты')), false);
  assert.equal(isFoodVenue(item('places','Магазин электроники')), false);
  assert.equal(isGroceryStore(item('places','Овощная лавка')), true);
  assert.equal(isShop(item('places','Овощная лавка')), true);
  assert.equal(isShop(item('places','Магазины / Продукты')), true);
  assert.equal(isCulturalPlace(item('places','Музеи / История')), true);
  assert.equal(isCulturalPlace(item('places','Парки / Прогулки')), true);
  assert.equal(isCulturalPlace(item('places','Достопримечательности')), true);
  assert.equal(isCulturalPlace(item('places','Гостиницы')), false);
  assert.equal(isShop(item('places','Продукты')), true);
  assert.equal(isShop(item('services','Магазины / Электроника')), true);
  assert.equal(isService(item('services','Ремонт')), true);
  assert.equal(isService(item('services','Госуслуги')), true);
  assert.equal(isService(item('services','Магазины')), false);
  assert.equal(isService(item('services','Доставка еды')), false);
});

test('today requires a real date or explicitly documented weekly schedule, never guesses from plain hours', () => {
  // Monday = 1; Wednesday = 3; Sunday = 0.
  assert.equal(hasDeclaredScheduleToday('10:00–18:00, вторник–воскресенье',3), true);
  assert.equal(hasDeclaredScheduleToday('10:00–18:00, вторник–воскресенье',1), false);
  assert.equal(hasDeclaredScheduleToday('10:00–18:00, вторник–воскресенье; понедельник выходной',1), false);
  assert.equal(hasDeclaredScheduleToday('10:00–18:00, вторник–воскресенье',0), true);
  assert.equal(hasDeclaredScheduleToday('10:00–18:00, понедельник–пятница',0), false);
  assert.equal(hasDeclaredScheduleToday('10:00–20:00 ежедневно',1), true);
  assert.equal(hasDeclaredScheduleToday('12:00–21:00',3), false);
  assert.equal(hasDeclaredScheduleToday('Временно закрыто, ежедневно 10:00–18:00',3), false);
  assert.equal(hasDeclaredScheduleToday(undefined,3), false);
  assert.equal(isTodayRecommendation(item('events','Кино',{dateOffset:0}),3), true);
  assert.equal(isTodayRecommendation(item('events','Кино',{dateOffset:1}),3), false);
  assert.equal(isTodayRecommendation(item('places','Гостиницы',{hours:'ежедневно, 10:00–20:00'}),3), false);
  assert.equal(isTodayRecommendation(item('places','Музеи',{hours:'вторник–воскресенье, 10:00–18:00'}),3), true);
});
test('today computes city weekday in Krasnoyarsk timezone, independent of visitor timezone', () => {
  assert.equal(weekdayInCity(new Date('2026-10-14T12:00:00Z')),3);
  assert.equal(weekdayInCity(new Date('2026-10-14T19:00:00Z')),4);
});
test('editorial recommendation selection is curated only for city whose entries were reviewed', () => {
  const a = item('places','Музеи',{id:'place-kytmanov-museum'});
  const b = item('places','Кафе',{id:'place-spassky-monastery'});
  assert.deepEqual(editorialPicks([a,b],'Енисейск').map(x=>x.id),['place-spassky-monastery','place-kytmanov-museum']);
  assert.deepEqual(editorialPicks([a,b],'Лесосибирск'),[]);
});
