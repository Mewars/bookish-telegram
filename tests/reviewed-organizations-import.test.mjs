import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {URL} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {prepareImport} from '../scripts/prepare-reviewed-organization-import.mjs';
import {requestCategory} from '../public/catalog/requestCategories.js';
import {mergePublished} from '../src/organizations/model.ts';

const manifest=JSON.parse(await readFile('data/imports/2026-10-21-organizations.json','utf8'));
test('reviewed batch has unique IDs, no foreign ratings and branches shared with requests',()=>{
 assert.equal(manifest.records.length,45);
 assert.equal(manifest.records.filter(r=>r.action==='insert').length,36);
 assert.equal(new Set(manifest.records.map(r=>r.organization.id)).size,45);
 for(const {organization:r,action} of manifest.records){
  assert(!('rating' in r));assert(!('reviews' in r));
  for(const key of ['website','source_url','image_url'])if(r[key])assert.equal(new URL(r[key]).protocol,'https:');
  assert.equal(r.latitude==null,r.longitude==null);
  if(action==='insert')assert.equal(requestCategory(r.category)?.kind,r.kind,r.category);
 }
 const draft=manifest.records.filter(r=>r.organization.status==='draft');
 assert.equal(draft.length,1);assert.equal(draft[0].organization.id,'place-ozernoe-library');
 assert.equal(mergePublished([],draft.map(r=>r.organization),'/fallback.svg').length,0);
 assert.equal(manifest.records.filter(r=>r.action==='insert'&&r.organization.image_url).length,10);
});
test('external organization photos keep an active source credit; owner images are unchanged',()=>{
 const r=manifest.records.find(r=>r.organization.id==='place-yandex-12667826474').organization;
 const item=mergePublished([],[r],'/fallback.svg')[0];
 assert.equal(item.image,r.image_url);assert.equal(item.photoSourceUrl,r.source_url);assert.match(item.photoCredit,/Яндекс/);
 const owner=mergePublished([],[{...r,image_url:'https://example.supabase.co/storage/v1/object/public/photos/owner.jpg'}],'/fallback.svg')[0];
 assert.equal(owner.photoCredit,undefined);assert.equal(owner.photoSourceUrl,undefined);
});
test('SQL import is atomic and preserves owner photos, edits, archives and other cities',async()=>{
 const db=new PGlite();
 const source=await readFile('docs/sql/organizations.sql','utf8');
 const table=source.slice(source.indexOf('CREATE TABLE public.organizations'),source.indexOf('-- Same identity strategy'));
 await db.exec(table+'ALTER TABLE public.organizations ADD COLUMN image_url text;');
 const r=manifest.records.find(r=>r.action==='enrich').organization;
 await db.query("INSERT INTO public.organizations SELECT * FROM jsonb_populate_record(null::public.organizations,$1::jsonb)",[JSON.stringify({...r,category:'Кафе',image_url:'https://example.org/owner.jpg',description:'Owner text',phone:'+7 999 123 45 67',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'})]);
 for(const sentinel of [{...r,id:'archived-existing',status:'archived'},{...r,id:'other-city',city:'Другой город'}])
  await db.query('INSERT INTO public.organizations SELECT * FROM jsonb_populate_record(null::public.organizations,$1::jsonb)',[JSON.stringify({...sentinel,created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'})]);
 const before=(await db.query('SELECT * FROM public.organizations')).rows;
 const subset={...manifest,records:[manifest.records.find(x=>x.organization.id===r.id),...manifest.records.filter(x=>x.action==='insert')]};
 const sql=prepareImport(subset,before);
 await db.exec(sql);
 const saved=(await db.query('SELECT * FROM public.organizations WHERE id=$1',[r.id])).rows[0];
 assert.equal(saved.image_url,'https://example.org/owner.jpg');assert.equal(saved.description,'Owner text');assert.equal(saved.phone,'+7 999 123 45 67');assert.equal(saved.category,r.category);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public.organizations')).rows[0].n,39);
 for(const sentinel of before.filter(r=>r.id!==saved.id))
  assert.deepEqual((await db.query('SELECT * FROM public.organizations WHERE id=$1',[sentinel.id])).rows[0],sentinel);
 await assert.rejects(db.exec(sql),/Catalog changed after review/);
 await db.exec('ROLLBACK');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public.organizations')).rows[0].n,39);
 assert.throws(()=>prepareImport(subset,[]),/Enrichment target missing/);
 await db.close();
});
