import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {adminCatalogGroups,adminSubcategories,matchesAdminGroup,matchesAdminSubcategory} from '../src/admin/catalogNavigation.ts';
test('one shared tree exposes food formats and other city categories without summary duplication',()=>{
 const food=adminCatalogGroups.find(g=>g.id==='Где поесть');assert(food);
 const subs=adminSubcategories(food.id);assert(subs.some(s=>s.label==='Столовые'));assert(subs.some(s=>s.label==='Пиццерии и суши'));
 const row={category:'Кафе / Столовые',title:'Проба',city:'Будущий город'};
 assert(matchesAdminGroup(row,food.id));assert(matchesAdminSubcategory(row,food.id,'Столовые'));
 assert(!matchesAdminSubcategory(row,food.id,'Кафе и кофейни'));
 assert(adminSubcategories('Гостиницы').some(s=>s.label==='Общежития'));
 assert(adminSubcategories('Госуслуги').some(s=>s.label.includes('Поисково-спасательные')));
});
test('permanent deletion enforces city roles and stale version; preserves applications and deletes dependent reviews',async()=>{
 const db=new PGlite();const owner='11111111-1111-4111-8111-111111111111',editor='22222222-2222-4222-8222-222222222222',resident='33333333-3333-4333-8333-333333333333';
 const as=async(role,id='')=>{await db.exec('RESET SESSION AUTHORIZATION');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET SESSION AUTHORIZATION '+role);};
 try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
   CREATE TABLE public.city_admin_access(user_id uuid,city text,role text,active boolean);
   INSERT INTO public.city_admin_access VALUES('${owner}','*','owner',true),('${editor}','Город А','editor',true);
   CREATE TABLE public.organizations(id text PRIMARY KEY,city text,updated_at timestamptz NOT NULL);
   INSERT INTO public.organizations VALUES('a','Город А','2026-10-21Z'),('b','Город Б','2026-10-21Z');
   CREATE TABLE public.organization_applications(id text,organization_id text REFERENCES public.organizations(id),status text);
   INSERT INTO public.organization_applications VALUES('app','a','approved');
   CREATE TABLE public.organization_reviews(id text,organization_id text REFERENCES public.organizations(id) ON DELETE CASCADE);
   INSERT INTO public.organization_reviews VALUES('review','a');
   GRANT SELECT ON public.organizations TO authenticated;`);
  await db.exec(await readFile('docs/sql/organization-hard-delete-v1.sql','utf8'));
  const call=(id,city,at='2026-10-21T00:00:00Z')=>db.query('select public.delete_organization($1,$2,$3) as id',[id,city,at]);
  await as('anon');await assert.rejects(call('a','Город А'),/permission denied/);
  await as('authenticated',resident);await assert.rejects(call('a','Город А'),/No permission/);
  await as('authenticated',editor);await assert.rejects(call('b','Город Б'),/No permission/);
  await assert.rejects(call('b','Город А'),/Organization changed/);
  await assert.rejects(call('a','Город А','2026-10-20T00:00:00Z'),/Organization changed/);
  await assert.rejects(db.exec("DELETE FROM public.organizations WHERE id='a'"),/permission denied/);
  assert.equal((await call('a','Город А')).rows[0].id,'a');
  await as('postgres');assert.equal((await db.query('select * from public.organization_reviews')).rows.length,0);
  assert.deepEqual((await db.query('select organization_id,status from public.organization_applications')).rows,[{organization_id:null,status:'approved'}]);
  await as('authenticated',owner);assert.equal((await call('b','Город Б')).rows[0].id,'b');
  await as('postgres');await db.exec("INSERT INTO public.organizations VALUES('c','Город Б','2026-10-21Z');UPDATE public.city_admin_access SET active=false");
  await as('authenticated',owner);await assert.rejects(call('c','Город Б'),/No permission/);
 }finally{await db.close();}
});
