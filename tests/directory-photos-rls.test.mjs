import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('isolated photo editor SQL: guests only read, admins alone can upload and edit', async t => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const editor = '22222222-2222-4222-8222-222222222222';
  const stranger = '33333333-3333-4333-8333-333333333333';
  const path = id => `eniseysk/${id}/44444444-4444-4444-8444-444444444444.webp`;
  const setRole = async (name, userId = '') => {
    await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)",[userId]);
    await db.exec(`SET SESSION AUTHORIZATION ${name}`);
  };
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${owner}'),('${editor}'),('${stranger}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(bucket_id text,name text,PRIMARY KEY(bucket_id,name));
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO authenticated;
      GRANT INSERT,DELETE,SELECT ON storage.objects TO authenticated;`);
    const sql = await readFile('docs/sql/directory-photos-admin.sql','utf8');
    assert.doesNotMatch(sql, /UPDATE\s+(?:public\.)?(?:profiles|user_favorites|user_identities)\b/i);
    assert.doesNotMatch(sql, /DROP\s+TABLE\b/i);
    await db.exec(sql);
    // The isolated migration must not need the full organizations table.
    assert.equal((await db.query("SELECT to_regclass('public.organizations') AS target")).rows[0].target,null);
    await db.query('INSERT INTO public.city_admin_access(user_id,city,role) VALUES ($1,$2,$3),($4,$5,$6)',[owner,'*','owner',editor,'Енисейск','editor']);

    await t.test('anonymous can read public photos, never write or see admin grants', async () => {
      await setRole('anon');
      assert.deepEqual((await db.query('SELECT card_id,city,storage_path,updated_at FROM public.directory_card_photos')).rows,[]);
      await assert.rejects(db.query('SELECT * FROM public.city_admin_access'), /permission denied/);
      await assert.rejects(db.query("INSERT INTO public.directory_card_photos(card_id,city,storage_path) VALUES ($1,$2,$3)",['place-myasorubka','Енисейск',path('place-myasorubka')]),/permission denied/);
    });

    await t.test('ordinary user cannot assign role or add photo',async () => {
      await setRole('authenticated',stranger);
      assert.equal((await db.query('SELECT user_id,city,role,active FROM public.city_admin_access')).rows.length,0);
      await assert.rejects(db.query('INSERT INTO public.city_admin_access(user_id,city,role) VALUES ($1,$2,$3)',[stranger,'*','owner']),/permission denied/);
      await assert.rejects(db.query('INSERT INTO public.directory_card_photos(card_id,city,storage_path) VALUES ($1,$2,$3)',['place-myasorubka','Енисейск',path('place-myasorubka')]),/row-level security/);
      await assert.rejects(db.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)',['ryadom-card-photos',path('place-myasorubka')]),/row-level security/);
    });

    await t.test('city editor can publish a valid photo, not invalid file paths',async () => {
      await setRole('authenticated',editor);
      await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)',['ryadom-card-photos',path('place-myasorubka')]);
      await db.query('INSERT INTO public.directory_card_photos(card_id,city,storage_path) VALUES ($1,$2,$3)',['place-myasorubka','Енисейск',path('place-myasorubka')]);
      assert.equal((await db.query("SELECT card_id FROM public.directory_card_photos WHERE card_id='place-myasorubka'")).rows.length,1);
      await assert.rejects(db.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)',['other-bucket',path('place-myasorubka')]),/row-level security/);
      await assert.rejects(db.query('INSERT INTO public.directory_card_photos(card_id,city,storage_path) VALUES ($1,$2,$3)',['service-post-663180','Енисейск','https://evil.example/photo.svg']),/check constraint/);
      await assert.rejects(db.query('INSERT INTO public.directory_card_photos(card_id,city,storage_path) VALUES ($1,$2,$3)',['place-other','Ачинск',path('place-other')]),/check constraint|row-level security/);
      await assert.rejects(db.query("UPDATE public.directory_card_photos SET city='Ачинск'"),/permission denied/);
    });

    await t.test('anonymous reads existing image but stranger cannot delete it',async () => {
      await setRole('anon');
      assert.equal((await db.query('SELECT card_id,storage_path FROM public.directory_card_photos')).rows.length,1);
      await setRole('authenticated',stranger);
      const deleted = await db.query("DELETE FROM public.directory_card_photos WHERE card_id='place-myasorubka' RETURNING card_id");
      assert.equal(deleted.rows.length,0);
    });

    await t.test('owner may remove image mapping, no existing profile changed',async () => {
      await setRole('authenticated',owner);
      const deleted = await db.query("DELETE FROM public.directory_card_photos WHERE card_id='place-myasorubka' RETURNING card_id");
      assert.equal(deleted.rows.length,1);
      await setRole('anon');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM public.directory_card_photos')).rows[0].n,0);
    });
  } finally { await db.close(); }
});

test('feature is gated, preserves all 25 static listings and strips EXIF through canvas', async () => {
  const app = await readFile('src/App.tsx','utf8');
  const page = await readFile('src/photos/PhotoAdminPage.tsx','utf8');
  const repo = await readFile('src/photos/directoryPhotos.ts','utf8');
  const workflow = await readFile('.github/workflows/sprinthost-deploy.yml','utf8');
  assert.match(app,/VITE_CARD_PHOTOS_ENABLED/);
  assert.match(workflow,/VITE_CARD_PHOTOS_ENABLED/);
  assert.match(app,/useDirectoryPhotos\(organizationCatalog\.items, photoEnabled\)/);
  assert.match(page,/readCityAccess/);
  assert.match(page,/Загрузить|Выбрать фотографию/);
  assert.match(page,/Сохранить фотографию/);
  assert.match(repo,/canvas\.toBlob/);
  assert.match(repo,/contentType: 'image\/webp'/);
  assert.match(repo,/cacheControl: '31536000'/);
  assert.doesNotMatch(repo,/service_role|sb_secret_|serviceRoleKey|localStorage/);
});
