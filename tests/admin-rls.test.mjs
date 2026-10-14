import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('city admin RLS and photo uploads are server-enforced', async t => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const editor = '22222222-2222-4222-8222-222222222222';
  const stranger = '33333333-3333-4333-8333-333333333333';
  const setRole = async (name, userId = '') => {
    await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await db.exec(`SET SESSION AUTHORIZATION ${name}`);
  };
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${owner}'), ('${editor}'), ('${stranger}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(bucket_id text NOT NULL,name text NOT NULL,PRIMARY KEY(bucket_id,name));
      CREATE FUNCTION storage.foldername(p_name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$SELECT string_to_array(p_name, '/')$$;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO authenticated;
      GRANT EXECUTE ON FUNCTION storage.foldername(text) TO authenticated;
      GRANT INSERT, SELECT ON storage.objects TO authenticated;`);
    await db.exec(await readFile('docs/sql/organizations.sql','utf8'));
    await db.exec(await readFile('docs/sql/organizations-seed.sql','utf8'));
    await db.exec(await readFile('docs/sql/city-admin-mvp.sql','utf8'));
    await db.query('INSERT INTO public.city_admin_access (user_id,city,role) VALUES ($1,$2,$3),($4,$5,$6)', [owner,'*','owner',editor,'Енисейск','editor']);
    await t.test('anonymous sees published rows, never drafts or access grants', async () => {
      await setRole('anon');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM public.organizations')).rows[0].n,8);
      await assert.rejects(db.query('SELECT * FROM public.city_admin_access'), /permission denied/);
      await assert.rejects(db.query("UPDATE public.organizations SET title='hacked'"), /permission denied/);
    });
    await t.test('unassigned account cannot elevate itself or write any organization', async () => {
      await setRole('authenticated', stranger);
      assert.equal((await db.query('SELECT * FROM public.city_admin_access')).rows.length,0);
      await assert.rejects(db.query("INSERT INTO public.city_admin_access(user_id,city,role) VALUES ($1,'*','owner')",[stranger]), /permission denied/);
      await assert.rejects(db.query("INSERT INTO public.organizations(id,city,title,category,description,source_type) VALUES ('bad','Енисейск','Bad','Кафе','No','user_provided')"), /row-level security/);
      await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('ryadom-places','Енисейск/untrusted.webp')"), /row-level security/);
    });
    await t.test('editor may write own city but never another city', async () => {
      await setRole('authenticated',editor);
      assert.equal((await db.query('SELECT city FROM public.city_admin_access')).rows[0].city,'Енисейск');
      await db.exec("INSERT INTO public.organizations(id,city,title,category,description,source_type,status) VALUES ('edited-local','Енисейск','Local test','Кафе','Valid','user_provided','draft')");
      assert.equal((await db.query("SELECT status FROM public.organizations WHERE id='edited-local'")).rows[0].status,'draft');
      await assert.rejects(db.query("INSERT INTO public.organizations(id,city,title,category,description,source_type,status) VALUES ('edited-foreign','Ачинск','Foreign','Кафе','Bad','user_provided','draft')"), /row-level security/);
      // PostgreSQL RLS silently filters invisible UPDATE targets (0 affected rows).
      await db.query("UPDATE public.organizations SET title='Bad' WHERE id='edited-foreign'");
      assert.equal((await db.query("SELECT count(*)::int AS n FROM public.organizations WHERE id='edited-foreign'")).rows[0].n, 0);
      await assert.rejects(db.query("UPDATE public.organizations SET city='Ачинск' WHERE id='edited-local'"), /permission denied/);
      await db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES ('ryadom-places','Енисейск/photo.webp')");
      await assert.rejects(db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES ('ryadom-places','Ачинск/photo.webp')"), /row-level security/);
      await assert.rejects(db.exec("UPDATE public.organizations SET status='published' WHERE id='edited-local'"), /check constraint/);
      await db.exec("UPDATE public.organizations SET verified_at='2026-10-14',status='published' WHERE id='edited-local'");
    });
    await t.test('suspended city editor loses write access while city stays visible and owner retains access', async () => {
      // This simulates the future billing suspension action on the existing
      // server-side access flag; no content/status rows are modified.
      await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE');
      await db.query("UPDATE public.city_admin_access SET active = false WHERE user_id = $1 AND city = $2 AND role = 'editor'", [editor, 'Енисейск']);

      await setRole('authenticated', editor);
      assert.equal((await db.query("SELECT active FROM public.city_admin_access WHERE city = 'Енисейск'")).rows[0].active, false);
      await assert.rejects(
        db.exec("INSERT INTO public.organizations(id,city,title,category,description,source_type,status) VALUES ('blocked-editor','Енисейск','Blocked','Кафе','Cannot publish','user_provided','draft')"),
        /row-level security/
      );
      const result = await db.exec("UPDATE public.organizations SET title = 'Should remain unchanged' WHERE id = 'edited-local'");
      assert.equal(result[0]?.rowCount ?? 0, 0);
      await assert.rejects(
        db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES ('ryadom-places','Енисейск/suspended.webp')"),
        /row-level security/
      );

      await setRole('anon');
      // Published cards are still readable for all visitors and were not archived.
      assert.equal((await db.query("SELECT count(*)::int AS n FROM public.organizations")).rows[0].n, 9);
      assert.equal((await db.query("SELECT status FROM public.organizations WHERE id = 'edited-local'")).rows[0].status, 'published');

      await setRole('authenticated', owner);
      await db.exec("INSERT INTO public.organizations(id,city,title,category,description,source_type,status) VALUES ('owner-during-suspension','Енисейск','Still manageable','Кафе','Platform owner can edit','user_provided','draft')");
      assert.equal((await db.query("SELECT status FROM public.organizations WHERE id = 'owner-during-suspension'")).rows[0].status, 'draft');
    });

    await t.test('owner can create a second city, ordinary users still see only published', async () => {
      await setRole('authenticated',owner);
      await db.exec("INSERT INTO public.organizations(id,city,title,category,description,source_type,status) VALUES ('new-foreign','Ачинск','Real future','Места','Draft','user_provided','draft')");
      assert.equal((await db.query("SELECT status FROM public.organizations WHERE id='new-foreign'")).rows[0].status,'draft');
      await setRole('anon');
      assert.equal((await db.query("SELECT count(*)::int AS n FROM public.organizations")).rows[0].n,9);
    });
  } finally { await db.close(); }
});
