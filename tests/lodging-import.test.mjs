import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {prepareImport} from '../scripts/prepare-reviewed-organization-import.mjs';
import {catalogGroups,lodgingSubcategory,matchesLeaf,matchesParent} from '../public/catalog/taxonomy.js';
import {requestCategory} from '../public/catalog/requestCategories.js';
import {matches} from '../src/utils/search.ts';
import {matchesCatalogFilters,emptyCatalogFilters} from '../src/navigation/catalogRoute.ts';
const manifest=JSON.parse(await readFile('data/imports/2026-10-21-lodging.json','utf8'));
test('lodging import excludes masked data, duplicate businesses and scraper notice',()=>{
 assert.equal(manifest.records.length,28);
 assert.equal(manifest.records.filter(r=>r.action==='insert').length,25);
 assert.equal(manifest.records.filter(r=>r.action==='enrich').length,3);
 assert.equal(new Set(manifest.records.map(r=>r.organization.id)).size,28);
 assert.equal(manifest.records.filter(r=>r.organization.status==='draft').length,1);
 for(const {organization:r,action} of manifest.records){
  assert(!JSON.stringify(r).includes('***'));assert(!('rating' in r));assert(!('reviews' in r));
  assert.equal(r.latitude==null,r.longitude==null);
  if(action==='insert')assert.equal(requestCategory(r.category)?.kind,r.kind,r.category);
 }
 const arbalet=manifest.records.find(r=>r.source_record_id==='124145027000').organization;
 assert.match(arbalet.address,/Озёрное/);assert.equal(arbalet.latitude,null);
 assert.equal(manifest.skipped.filter(r=>['216012104131','192391931816','239571889275','146589397670'].includes(r.id)).length,4);
});
test('guest house remains in its museum branch and is also discoverable as accommodation in any city',()=>{
 const parent=catalogGroups.flatMap(g=>g.items).find(p=>p.name==='Гостиницы');
 const item={kind:'places',city:'Будущий город',title:'Гостевой дом купца Тестова',category:'Музеи / История',description:'Исторический дом'};
 assert.equal(lodgingSubcategory(item).name,'Гостевые дома');assert(matchesParent(item,parent));
 assert(matchesLeaf(item,parent.subs.find(s=>s.name==='Гостевые дома'),parent));
 assert(matches(item,'гостиниц'));assert(matches(item,'гостев'));
 assert(matchesCatalogFilters(item,{...emptyCatalogFilters,category:'Гостиницы',subcategory:'Гостевые дома'}));
 assert(matchesCatalogFilters(item,{...emptyCatalogFilters,category:'Музеи'}));
 assert.equal(lodgingSubcategory({...item,title:'Музей',description:'Рядом гостевой дом и гостиница'}),null);
 assert.equal(lodgingSubcategory({category:'Гостиницы / Общежития',title:'Тест'}).name,'Общежития');
});
test('second batch preserves existing owner content and primary museum category in PostgreSQL',async()=>{
 const db=new PGlite();
 try{
  const schema=await readFile('docs/sql/organizations.sql','utf8');
  await db.exec(schema.slice(schema.indexOf('CREATE TABLE public.organizations'),schema.indexOf('-- Same identity strategy'))+'ALTER TABLE public.organizations ADD COLUMN image_url text;');
  const before=manifest.records.filter(r=>r.action==='enrich').map(({organization:r})=>({...r,category:r.id==='place-borodkin-house'?'Музеи / История':'Гостиницы',title:r.id==='place-borodkin-house'?'Гостевой дом купца Бородкина / Дом Бородкина':r.title,description:'Текст владельца',phone:'+7 999 123 45 67',image_url:'https://example.org/owner.jpg',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'}));
  await db.query('INSERT INTO public.organizations SELECT * FROM jsonb_populate_recordset(null::public.organizations,$1::jsonb)',[JSON.stringify(before)]);
  const sql=prepareImport(manifest,before);await db.exec(sql);
  const rows=(await db.query('SELECT * FROM public.organizations')).rows;assert.equal(rows.length,28);
  for(const old of before){const r=rows.find(r=>r.id===old.id);assert.equal(r.image_url,old.image_url);assert.equal(r.title,old.title);assert.equal(r.description,old.description);assert.equal(r.phone,old.phone);}
  assert.equal(rows.find(r=>r.id==='place-borodkin-house').category,'Музеи / История');
  assert.equal(rows.find(r=>r.id==='place-hotel-domino').category,'Гостиницы / Гостиницы и отели');
  await assert.rejects(db.exec(sql),/Catalog changed after review/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
