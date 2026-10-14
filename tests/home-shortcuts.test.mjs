import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';

const cityHome = await readFile(new URL('../src/components/CityHome.tsx', import.meta.url), 'utf8');
const homeStyles = await readFile(new URL('../src/styles/home.css', import.meta.url), 'utf8');

test('all five home shortcuts remain visible even when a category has no cards', () => {
  for (const label of ['Сегодня', 'Поесть', 'Культура', 'Магазины', 'Услуги']) {
    assert.ok(cityHome.includes(`label: '${label}'`));
  }
  assert.match(cityHome, /\{discoveries\.map\(option =>/);
  assert.doesNotMatch(cityHome, /label: 'Погулять'/);
  assert.doesNotMatch(cityHome, /availableDiscoveries/);
});

test('shortcut click clears old text search, selects destination and auto-scrolls to results', () => {
  assert.match(cityHome, /setQuery\(''\);\s*setDiscovery\(label\);\s*showResults\(\)/);
  assert.match(cityHome, /onClick=\{\(\) => chooseDiscovery\(option\.label\)\}/);
  assert.match(cityHome, /getElementById\('city-selections'\)\?\.scrollIntoView/);
  assert.match(cityHome, /prefers-reduced-motion: reduce/);
  assert.match(homeStyles, /#city-selections\s*\{\s*scroll-margin-top:/);
});

test('empty shortcuts and sections explain there are no confirmed listings', () => {
  assert.match(cityHome, /selected \? 'Пока нет записей'/);
  assert.match(cityHome, /city-section-coming-soon/);
  assert.doesNotMatch(cityHome, /entries\.length > 0 && <section/);
});

test('homepage uses distinct editorial, event, food, culture, retail and service rails', async () => {
  const homeCarousel = await readFile(new URL('../src/components/HomeCarousel.tsx', import.meta.url),'utf8');
  for (const title of ['Выбор «Рядом»','Афиша города','Где поесть','Что посмотреть','За покупками','Услуги','Партнёры «Рядом»']) {
    assert.ok(cityHome.includes(title), title);
  }
  assert.doesNotMatch(cityHome, /Популярные места|Куда сходить|Услуги рядом|Места, которые стоит увидеть/);
  assert.match(homeCarousel, /items\.map\(item => <Card key=\{item\.id\}/);
  assert.doesNotMatch(homeCarousel, /items\.slice\(/);
  assert.match(homeCarousel, /node\.scrollBy\(/);
  assert.match(homeCarousel, /ResizeObserver/);
  assert.match(homeCarousel, /aria-controls=/);
  assert.match(homeStyles, /home-carousel-arrow--next/);
  assert.match(homeStyles, /scroll-snap-type:x mandatory/);
  assert.match(cityHome, /VITE_HOME_BACKDROP_ENABLED !== 'false'/);
  assert.match(cityHome, /className="city-selections-backdrop"/);
  assert.match(cityHome, /Реклама не подменяет редакционные рекомендации/);
});
