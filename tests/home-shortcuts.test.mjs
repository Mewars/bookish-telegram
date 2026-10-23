import {URL} from 'node:url';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
const home=await readFile(new URL('../src/components/CityHome.tsx',import.meta.url),'utf8');
test('homepage retains public catalog search and reduced-motion navigation',()=>{
 assert.match(home,/rememberHomeSearch\(city,query\)/);
 assert.match(home,/getElementById\('city-selections'\)\?\.scrollIntoView/);
 assert.match(home,/prefers-reduced-motion: reduce/);
 assert.match(home,/setQuery\(''\);\s*setDiscovery\(label\);\s*showResults\(\)/);
});
test('native city sections use explicit city links instead of beta-only React pages',()=>{
 for(const section of ['classifieds','wall'])assert.ok(home.includes(`hostSectionHref('${section}',city`));
 assert.doesNotMatch(home,/navigate\('(classifieds|community)'\)/);
 assert.match(home,/ryadomOpenCategories/);
});
test('empty public feeds do not turn into invented content or empty advertising rails',()=>{
 assert.match(home,/feed\.listings\.length>0&&/);
 assert.match(home,/events\.length>0&&/);
 assert.match(home,/Город начинается с нас/);
 assert.doesNotMatch(home,/Выбор «Рядом»|Партнёры «Рядом»|HomeCarousel/);
});
