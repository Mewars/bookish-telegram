import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {readCityPins,sortPinnedClassifieds} from '../host-public/classifieds/pins.js';
test('pin ordering keeps old pinned listings before recent unpinned ones without mutating input',()=>{
 const rows=[{id:'new',created_at:'2026-10-21'},{id:'old',created_at:'2025-01-01'}];
 assert.deepEqual(sortPinnedClassifieds(rows,new Map([['old','2026-10-21']])).map(x=>x.id),['old','new']);
 assert.equal(rows[0].id,'new');
});
test('unapplied pin schema preserves the ordinary classifieds feed',async()=>{
 const client={from(){return {select(){return this},eq(){return this},order(){return this},range(){return Promise.resolve({data:null,error:{code:'PGRST205'}})}}}};
 assert.equal((await readCityPins(client,'Будущий город')).available,false);
});
test('only active global owner can pin; no direct writes, no private listing leakage',async()=>{
 const db=new PGlite();
 const owner='11111111-1111-4111-8111-111111111111',resident='22222222-2222-4222-8222-222222222222';
 const pub='33333333-3333-4333-8333-333333333333',draft='44444444-4444-4444-8444-444444444444';
 const role=async(name,id='')=>{await db.exec('RESET SESSION AUTHORIZATION');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET SESSION AUTHORIZATION '+name);};
 try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
   CREATE TABLE public.city_admin_access(user_id uuid,city text,role text,active boolean);
   INSERT INTO public.city_admin_access VALUES('${owner}','*','owner',true),('${resident}','Город будущего','editor',true);
   CREATE TABLE public.classifieds(id uuid PRIMARY KEY,status text,city text);
   INSERT INTO public.classifieds VALUES('${pub}','published','Город будущего'),('${draft}','draft','Другой город');
   ALTER TABLE public.classifieds ENABLE ROW LEVEL SECURITY;
   CREATE POLICY published ON public.classifieds FOR SELECT TO anon,authenticated USING(status='published');
   GRANT SELECT ON public.classifieds TO anon,authenticated;`);
  await db.exec(await readFile('docs/sql/classified-owner-pins-v1.sql','utf8'));
  await role('anon');await assert.rejects(db.query('select public.owner_pin_classified($1,true)',[pub]),/permission denied/);
  await role('authenticated',resident);await assert.rejects(db.query('select public.owner_pin_classified($1,true)',[pub]),/Only platform owner/);
  await role('authenticated',owner);
  await assert.rejects(db.query('insert into public.classified_owner_pins(listing_id) values($1)',[pub]),/permission denied/);
  await assert.rejects(db.query('select public.owner_pin_classified($1,true)',[draft]),/Published classified not found/);
  assert.equal((await db.query('select public.owner_pin_classified($1,true) as pinned',[pub])).rows[0].pinned,true);
  await role('anon');assert.equal((await db.query('select * from public.classified_owner_pins')).rows.length,1);
  await role('postgres');await db.query("update public.classifieds set status='draft' where id=$1",[pub]);
  await role('anon');assert.equal((await db.query('select * from public.classified_owner_pins')).rows.length,0);
  await role('authenticated',owner);assert.equal((await db.query('select public.owner_pin_classified($1,false) as pinned',[pub])).rows[0].pinned,false);
  await role('postgres');await db.exec('update public.city_admin_access set active=false');
  await role('authenticated',owner);await assert.rejects(db.query('select public.owner_pin_classified($1,true)',[pub]),/Only platform owner/);
 }finally{await db.close();}
});
