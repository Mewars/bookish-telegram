import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';

test('organization applications: private photographs, city review, atomic publish',async t=>{
 const db=new PGlite();
 const applicant='11111111-1111-4111-8111-111111111111';
 const editor='22222222-2222-4222-8222-222222222222';
 const outsider='33333333-3333-4333-8333-333333333333';
 const other='44444444-4444-4444-8444-444444444444';
 const reset=async(role,id='')=>{
  await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec(`SET SESSION AUTHORIZATION ${role}`);
 };
 try{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
   CREATE SCHEMA auth;
   CREATE TABLE auth.users(id uuid PRIMARY KEY);
   INSERT INTO auth.users VALUES ('${applicant}'),('${editor}'),('${outsider}'),('${other}');
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
     $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
   GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
   CREATE SCHEMA storage;
   CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   CREATE TABLE storage.objects(bucket_id text NOT NULL,name text NOT NULL,PRIMARY KEY(bucket_id,name));
   CREATE FUNCTION storage.foldername(p_name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $folder$ SELECT string_to_array(p_name,'/') $folder$;
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   GRANT USAGE ON SCHEMA storage TO authenticated;
   GRANT INSERT,SELECT ON storage.objects TO authenticated;`);
  await db.exec(await readFile('docs/sql/organizations.sql','utf8'));
  await db.exec(await readFile('docs/sql/city-admin-mvp.sql','utf8'));
  await db.exec(await readFile('docs/sql/organization-request-review-photos-v1.sql','utf8'));
  await db.query('INSERT INTO public.city_admin_access (user_id,city,role) VALUES ($1,$2,$3)',[editor,'Енисейск','editor']);
  let appId='';
  const insert=async(city,req)=>db.query(`INSERT INTO public.organization_applications
   (applicant_id,client_request_id,title,city,category,address,description,source_note,consent_accepted,consent_version)
   VALUES ($1,$2,'Кафе Тест','${city}','Кафе','ул. Тестовая 1','Описание кафе','Видел лично',true,'ORG-APPLICATION-1.0')
   RETURNING id`,[applicant,req]);
  await t.test('applicant sends pending request while guest sees nothing',async()=>{
    await reset('authenticated',applicant);
    appId=(await insert('Енисейск','55555555-5555-4555-8555-555555555555')).rows[0].id;
    await reset('anon');
    await assert.rejects(db.query('SELECT id FROM public.organization_applications'),/permission denied/);
    await assert.rejects(db.query("SELECT public.review_organization_request($1,'approved',NULL,NULL)",[appId]),/permission denied/);
    await reset('authenticated',outsider);
    assert.equal((await db.query('SELECT id FROM public.organization_applications')).rows.length,0);
  });
  let photo='';
  photo=`${applicant}/${appId}/66666666-6666-4666-8666-666666666666.webp`;
  await t.test('photo uploads are private and restricted to own pending application',async()=>{
    await reset('authenticated',applicant);
    await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('ryadom-org-requests',$1) RETURNING name",[photo]);
    await db.query('UPDATE public.organization_applications SET photo_path=$1 WHERE id=$2',[photo,appId]);
    assert.equal((await db.query('SELECT photo_path FROM public.organization_applications WHERE id=$1',[appId])).rows[0].photo_path,photo);
    await assert.rejects(db.query("UPDATE public.organization_applications SET status='approved' WHERE id=$1",[appId]),/permission denied/);
    const blocked=await db.query("UPDATE public.organization_applications SET photo_path='bad' WHERE id=$1 RETURNING id",[appId]);
    assert.equal(blocked.rows.length,0,'RLS must silently block replacing attached photo');
    assert.equal((await db.query('SELECT photo_path FROM public.organization_applications WHERE id=$1',[appId])).rows[0].photo_path,photo);
    await reset('authenticated',outsider);
    assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='ryadom-org-requests'")).rows.length,0);
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('ryadom-org-requests',$1)",[photo]),/row-level security/);
    await reset('authenticated',editor);
    assert.equal((await db.query("SELECT id,photo_path FROM public.organization_applications WHERE id=$1",[appId])).rows[0].photo_path,photo);
    assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='ryadom-org-requests'")).rows.length,1);
  });
  await t.test('outsiders, applicant and cross-city editor cannot approve',async()=>{
    const draft={city:'Енисейск',kind:'places',status:'published',title:'Кафе Тест',category:'Кафе',description:'Подробное описание',address:'ул. Тестовая 1'};
    for(const id of [applicant,outsider]){
      await reset('authenticated',id);
      await assert.rejects(db.query("SELECT public.review_organization_request($1,'approved',$2,NULL)",[appId,JSON.stringify(draft)]),/Not authorized/);
    }
    await reset('authenticated',editor);
    await assert.rejects(db.query("SELECT public.review_organization_request($1,'approved',$2,NULL)",[appId,JSON.stringify({...draft,city:'Ачинск'})]),/must match/);
    assert.equal((await db.query("SELECT status FROM public.organization_applications WHERE id=$1",[appId])).rows[0].status,'pending');
    const result=await db.query("SELECT public.review_organization_request($1,'approved',$2,NULL) AS id",[appId,JSON.stringify(draft)]);
    const publishedId=result.rows[0].id;
    assert.ok(publishedId.startsWith('place-'));
    assert.equal((await db.query('SELECT status FROM public.organizations WHERE id=$1',[publishedId])).rows[0].status,'published');
    assert.equal((await db.query('SELECT status,organization_id FROM public.organization_applications WHERE id=$1',[appId])).rows[0].organization_id,publishedId);
    await assert.rejects(db.query("SELECT public.review_organization_request($1,'approved',$2,NULL)",[appId,JSON.stringify(draft)]),/not pending/);
  });
  await t.test('review rejection requires reason, preserves private application',async()=>{
    await reset('authenticated',applicant);
    const id=(await insert('Енисейск','77777777-7777-4777-8777-777777777777')).rows[0].id;
    await reset('authenticated',editor);
    await assert.rejects(db.query("SELECT public.review_organization_request($1,'rejected',NULL,'нет')",[id]),/reason/);
    await db.query("SELECT public.review_organization_request($1,'rejected',NULL,'Нужно указать точный адрес')",[id]);
    assert.equal((await db.query('SELECT status FROM public.organization_applications WHERE id=$1',[id])).rows[0].status,'rejected');
  });
 }finally{await db.close();}
});
