import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { visibleClassifiedListings } from '../src/classifieds/listFilters.ts';

const entries=[
  {id:'alpha',deal_type:'sell',title:'Велосипед',description:'Городской велосипед',category:'Транспорт'},
  {id:'beta',deal_type:'rent_in',title:'Квартира',description:'Снять на месяц',category:'Недвижимость'},
];

test('search and deal filters only apply to published browsing tab',()=>{
  assert.deepEqual(visibleClassifiedListings(entries,'browse','sell','велосипед').map(x=>x.id),['alpha']);
  assert.deepEqual(visibleClassifiedListings(entries,'browse','sell','квартира'),[]);
  assert.deepEqual(visibleClassifiedListings(entries,'browse',null,'КВАРТИРА').map(x=>x.id),['beta']);
  assert.deepEqual(visibleClassifiedListings(entries,'mine','sell','велосипед').map(x=>x.id),['alpha','beta']);
  assert.deepEqual(visibleClassifiedListings(entries,'moderate','sell','велосипед').map(x=>x.id),['alpha','beta']);
});

test('load failures never misrepresent stale listings, reports or conversations as current',async()=>{
  const page=await readFile('src/classifieds/ClassifiedsPage.tsx','utf8');
  assert.match(page,/const \[loadFailedKey,setLoadFailedKey\]=useState\(''\)/);
  assert.match(page,/setLoadFailedKey\(viewKey\)/);
  assert.match(page,/setItems\(\[\]\);setReports\(\[\]\);setThreads\(\[\]\)/);
  assert.match(page,/loadFailedKey===viewKey\?<div className="classifieds-empty" role="alert"/);
  assert.match(page,/Не удалось загрузить объявления/);
  assert.match(page,/Не удалось загрузить жалобы/);
  assert.match(page,/Не удалось загрузить переписки/);
  assert.match(page,/activeThread=loading\|\|loadFailedKey===viewKey/);
  assert.match(page,/visibleClassifiedListings\(items,/);
  assert.match(page,/Повторить загрузку/);
});

test('production remains protected by explicit test-only beta gating',async()=>{
  const app=await readFile('src/App.tsx','utf8');
  assert.match(app,/VITE_CLASSIFIEDS_ENABLED === 'true'/);
  assert.match(app,/djqhixvlfsbvannoqdjw/);
});
