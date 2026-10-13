import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';

const cityHome = await readFile(new URL('../src/components/CityHome.tsx', import.meta.url), 'utf8');
const homeStyles = await readFile(new URL('../src/styles/home.css', import.meta.url), 'utf8');

test('all five home shortcuts remain visible even when a category has no cards', () => {
  for (const label of ['Сегодня', 'Поесть', 'Погулять', 'Культура', 'Услуги']) {
    assert.ok(cityHome.includes(`label: '${label}'`));
  }
  assert.match(cityHome, /\{discoveries\.map\(option =>/);
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
