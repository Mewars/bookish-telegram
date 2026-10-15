import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('classified gallery RLS: slots, private drafts, public approvals',async t=>{
 const db=new PGlite();
 const users=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
 const [seller,outsider,editor,foreignEditor]=users;
 const act=async(role,id='')=>{
   await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
   await db.exec('SET SESSION AUTHORIZATION '+role);
 };
 try{
   await db.exec([
    "CREATE ROLE anon; CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS",
    "CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)",
    "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$",
    "GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role",
    "GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated",
    "CREATE TABLE public.city_directory(name text PRIMARY KEY,active boolean NOT NULL DEFAULT true)",
    "INSERT INTO public.city_directory(name) VALUES ('Енисейск'),('Лесосибирск')",
    "GRANT SELECT ON public.city_directory TO anon,authenticated",
    "CREATE TABLE public.city_admin_access(user_id uuid REFERENCES auth.users(id),city text,role text,active boolean NOT NULL DEFAULT true,PRIMARY KEY(user_id,city))",
    "GRANT SELECT ON public.city_admin_access TO authenticated",
    "CREATE SCHEMA storage",
    "CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])",
    "CREATE TABLE storage.objects(bucket_id text NOT NULL,name text NOT NULL,PRIMARY KEY(bucket_id,name))",
    "ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY",
    "GRANT USAGE ON SCHEMA storage TO anon,authenticated",
    "GRANT SELECT ON storage.objects TO anon,authenticated",
    "GRANT INSERT,DELETE ON storage.objects TO authenticated"
   ].join(';\n')+';');
   for(const id of users)await db.query('INSERT INTO auth.users(id) VALUES ($1)',[id]);
   await db.query("INSERT INTO public.city_admin_access(user_id,city,role) VALUES ($1,'Енисейск','editor'),($2,'Лесосибирск','editor')",[editor,foreignEditor]);
   for(const file of ['classifieds-private-messaging-v1.sql','classifieds-editor-privacy-v2.sql','classified-photos-private-v1.sql','classified-reports-review-v1.sql'])
     await db.exec(await readFile('docs/sql/'+file,'utf8'));
   const bucket=(await db.query("SELECT public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='ryadom-classified-photos'")).rows[0];
   assert.equal(bucket.public,false);assert.equal(bucket.file_size_limit,2097152);
   assert.deepEqual(bucket.allowed_mime_types,['image/webp','image/jpeg']);
   let listing,path;
   await t.test('only listing author can reserve path, no 11th photo',async()=>{
     await act('authenticated',seller);
     listing=(await db.query("INSERT INTO public.classifieds(city,deal_type,category,title,description) VALUES ('Енисейск','sell','Для дома','Продам стол','Настоящее объявление для тестирования') RETURNING id")).rows[0].id;
     path=(await db.query("INSERT INTO public.classified_photos(listing_id,slot,format) VALUES ($1,0,'webp') RETURNING object_path",[listing])).rows[0].object_path;
     assert.ok(path.startsWith(listing+'/'));
     await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('ryadom-classified-photos',$1)",[path]);
     await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('ryadom-classified-photos',$1)",[listing+'/ffffffff-ffff-4fff-8fff-ffffffffffff.webp']),/row-level security/);
     await assert.rejects(db.query("INSERT INTO public.classified_photos(listing_id,slot,format) VALUES ($1,0,'webp')",[listing]),/duplicate key/);
     await assert.rejects(db.query("INSERT INTO public.classified_photos(listing_id,slot,format) VALUES ($1,10,'webp')",[listing]),/check constraint/);
     await act('authenticated',outsider);
     assert.equal((await db.query('SELECT * FROM public.classified_photos')).rows.length,0);
     assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id='ryadom-classified-photos'")).rows.length,0);
     await assert.rejects(db.query("INSERT INTO public.classified_photos(listing_id,slot,format) VALUES ($1,1,'webp')",[listing]),/row-level security/);
   });
   await t.test('draft is invisible; pending is visible only to matching editor',async()=>{
     await act('anon');
     assert.equal((await db.query('SELECT * FROM public.classified_photos')).rows.length,0);
     assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);
     await act('authenticated',editor);
     assert.equal((await db.query('SELECT * FROM public.classified_photos')).rows.length,0);
     await act('authenticated',seller);
     await db.query("UPDATE public.classifieds SET status='pending' WHERE id=$1",[listing]);
     assert.equal((await db.query('DELETE FROM public.classified_photos WHERE listing_id=$1 RETURNING id',[listing])).rows.length,0);
     await act('authenticated',editor);
     assert.equal((await db.query('SELECT * FROM public.classified_photos')).rows.length,1);
     assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,1);
     await act('authenticated',foreignEditor);
     assert.equal((await db.query('SELECT * FROM public.classified_photos')).rows.length,0);
     await act('anon');
     assert.equal((await db.query('SELECT * FROM public.classified_photos')).rows.length,0);
   });
   await t.test('publishing reveals image, not modification permissions',async()=>{
     await act('authenticated',editor);
     await db.query('SELECT public.review_classified($1,true)',[listing]);
     await act('anon');
     assert.equal((await db.query('SELECT * FROM public.classified_photos')).rows.length,1);
     assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,1);
     await act('authenticated',seller);
     assert.equal((await db.query('DELETE FROM public.classified_photos WHERE listing_id=$1 RETURNING id',[listing])).rows.length,0);
     assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name',[path])).rows.length,0);
   });
   await t.test('city report withdraws public photo access without deleting the owner album',async()=>{
     // Synthetic accounts and storage metadata only; no real photos or signed URLs.
     await act('authenticated',outsider);
     const report=(await db.query(
       "INSERT INTO public.classified_reports(listing_id,reason) VALUES ($1,'Фотография не соответствует описанию объявления') RETURNING id",
       [listing],
     )).rows[0].id;

     await act('authenticated',foreignEditor);
     await assert.rejects(db.query('SELECT public.review_classified_report($1,true)',[report]),/Not authorized/);
     await act('authenticated',seller);
     await assert.rejects(db.query('SELECT public.review_classified_report($1,true)',[report]),/Not authorized/);

     await act('authenticated',editor);
     await db.query('SELECT public.review_classified_report($1,true)',[report]);
     assert.equal((await db.query('SELECT status FROM public.classifieds WHERE id=$1',[listing])).rows.length,0,
       'The editor cannot read an archived listing through public or pending-only policies');

     await act('anon');
     assert.equal((await db.query('SELECT id FROM public.classified_photos WHERE listing_id=$1',[listing])).rows.length,0);
     assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='ryadom-classified-photos' AND name=$1",[path])).rows.length,0);

     await act('authenticated',outsider);
     assert.equal((await db.query('SELECT id FROM public.classified_photos WHERE listing_id=$1',[listing])).rows.length,0);
     assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='ryadom-classified-photos' AND name=$1",[path])).rows.length,0);
     assert.equal((await db.query(
       "DELETE FROM storage.objects WHERE bucket_id='ryadom-classified-photos' AND name=$1 RETURNING name",[path],
     )).rows.length,0,'Another user cannot delete a hidden photo');

     await act('authenticated',seller);
     assert.equal((await db.query('SELECT status FROM public.classifieds WHERE id=$1',[listing])).rows[0].status,'archived');
     assert.equal((await db.query('SELECT id FROM public.classified_photos WHERE listing_id=$1',[listing])).rows.length,1);
     assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='ryadom-classified-photos' AND name=$1",[path])).rows.length,1);
     await assert.rejects(
       db.query("INSERT INTO public.classified_photos(listing_id,slot,format) VALUES ($1,1,'webp')",[listing]),
       /row-level security/,
     );
   });
 }finally{await db.close();}
});
