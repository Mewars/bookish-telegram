import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {prepareCatalogBatch} from '../scripts/prepare-catalog-batch.mjs';
import {requestCategory} from '../public/catalog/requestCategories.js';
const batch=JSON.parse(await readFile('data/imports/2026-10-25-organizations.json','utf8'));
test('new batch separates masked, existing and ambiguous records; categories and links match the basic offer',()=>{
 assert.equal(batch.records.length,81);assert.equal(batch.unique_source_ids,batch.records.length+batch.decisions.length);
 assert.equal(batch.decisions.filter(r=>r.reason.includes('скрыты')).length,61);
 for(const r of batch.records){assert.equal(requestCategory(r.category)?.kind,r.kind,r.category);assert.equal(r.website,null);assert.equal(r.vk_url,null);assert(!JSON.stringify([r.title,r.address,r.phone,r.hours]).includes('***'));assert(!('rating' in r));}
 const ids=batch.records.map(r=>r.id);
 for(const excluded of ['27678433164','48751381113','92659596322','245003604119','1067169773','100502496119'])assert(!ids.includes('place-yandex-'+excluded));
});
test('atomic import enriches only missing contacts; preserves owner edits and other cities; cannot repeat on a stale revision',async()=>{
 const db=new PGlite();const schema=await readFile('docs/sql/organizations.sql','utf8');
 await db.exec(schema.slice(schema.indexOf('CREATE TABLE public.organizations'),schema.indexOf('-- Same identity strategy'))+'ALTER TABLE public.organizations ADD COLUMN image_url text;');
 for(const [id,city,status] of [['place-ozernoe-school-47','Енисейск','published'],['foreign','Другой город','published'],['closed','Енисейск','archived']]){
  await db.query('INSERT INTO public.organizations(id,city,title,category,description,phone,hours,image_url,source_type,verified_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,city,'Owner '+id,'Owner category','Owner text','+7 999 123 45 67',null,'https://example.org/owner.webp','user_provided','2026-10-01',status]);
 }
 const rev=async()=>(await db.query("SELECT md5(coalesce(string_agg(id || ':' || updated_at::text,',' ORDER BY id),'')) AS r FROM public.organizations")).rows[0].r;
 const before=(await db.query('SELECT * FROM public.organizations WHERE id IN ($1,$2) ORDER BY id',['foreign','closed'])).rows;
 const sql=prepareCatalogBatch(batch,await rev());await db.exec(sql);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public.organizations')).rows[0].n,84);
 const owner=(await db.query("SELECT * FROM public.organizations WHERE id='place-ozernoe-school-47'")).rows[0];
 assert.equal(owner.phone,'+7 999 123 45 67');assert.equal(owner.hours,'пн-сб 08:00–20:00');assert.equal(owner.image_url,'https://example.org/owner.webp');assert.equal(owner.title,'Owner place-ozernoe-school-47');
 assert.deepEqual((await db.query('SELECT * FROM public.organizations WHERE id IN ($1,$2) ORDER BY id',['foreign','closed'])).rows,before);
 await assert.rejects(db.exec(sql),/Catalog changed/);await db.exec('ROLLBACK');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public.organizations')).rows[0].n,84);
 await assert.rejects(db.exec(prepareCatalogBatch(batch,await rev())),/duplicate key/);await db.exec('ROLLBACK');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public.organizations')).rows[0].n,84);
 await db.close();
});
