import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL/WASM, never a remote Supabase. Mimic JWT auth.uid() and API roles.
// These tests cannot replace verification in an actual disposable Supabase project.
test('manual SQL: RLS, column grants, consent, moderation, dedupe and legacy seed', async t => {
  const db = new PGlite();
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  const request = '33333333-3333-4333-8333-333333333333';
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
      INSERT INTO auth.users VALUES ('${a}'),('${b}');`);
    await db.exec(await readFile(new URL('../docs/sql/organizations.sql', import.meta.url), 'utf8'));
    const seed = await readFile(new URL('../docs/sql/organizations-seed.sql', import.meta.url), 'utf8');
    await db.exec(seed); await db.exec(seed);
    await db.exec(`INSERT INTO public.organizations (id,city,title,category,description,source_type) VALUES ('private-draft','Енисейск','Private draft','Test','Test','manual_verified');`);
    const role = async (name, id = '') => { await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]); await db.exec(`SET SESSION AUTHORIZATION ${name}`); };
    const insert = (id, req, extra = '') => db.query(`INSERT INTO public.organization_applications (applicant_id,client_request_id,title,city,category,address,description,source_note,consent_accepted,consent_version${extra ? ',status' : ''}) VALUES ($1,$2,'Test request','Енисейск','Test','Test address','Test description','Test source',true,'ORG-APPLICATION-1.0'${extra ? ",'approved'" : ''}) RETURNING id,status`, [id,req]);
    await t.test('guest sees exactly 8 active places, no draft, no applications', async () => {
      await role('anon');
      const rows = (await db.query('SELECT id FROM public.organizations ORDER BY id')).rows;
      const original = await readFile(new URL('../src/data/places.ts', import.meta.url), 'utf8');
      assert.deepEqual(rows.map(row => row.id), [...original.matchAll(/id: '([^']+)'/g)].map(match => match[1]).sort());
      await assert.rejects(db.query('SELECT * FROM public.organization_applications'), /permission denied/);
      await assert.rejects(db.query("UPDATE public.organizations SET title='bad'"), /permission denied/);
      await assert.rejects(insert(a,request), /permission denied/);
    });
    let applicationId;
    await t.test('authenticated creates own pending request, cannot insert approved status', async () => {
      await role('authenticated',a);
      const rows = (await insert(a,request)).rows;
      applicationId = rows[0].id; assert.equal(rows[0].status,'pending');
      await assert.rejects(insert(a,'44444444-4444-4444-8444-444444444444',true), /permission denied/);
      await assert.rejects(insert(b,'44444444-4444-4444-8444-444444444444'), /row-level security/);
      assert.equal((await db.query('SELECT * FROM public.organization_applications')).rows.length,1);
    });
    await t.test('other account cannot read, update or delete another request', async () => {
      await role('authenticated',b);
      assert.equal((await db.query('SELECT * FROM public.organization_applications')).rows.length,0);
      await assert.rejects(db.query("UPDATE public.organization_applications SET status='approved'"), /permission denied/);
      await assert.rejects(db.query('DELETE FROM public.organization_applications'), /permission denied/);
      await assert.rejects(db.query("INSERT INTO public.organizations (id) VALUES ('bad')"), /permission denied/);
    });
    await t.test('no account escalation and trusted publish procedure is inaccessible by RPC', async () => {
      await assert.rejects(db.query('SET ROLE service_role'), /permission denied/);
      await assert.rejects(db.query('SELECT public.publish_organization_application($1,$2,$3::jsonb)',[applicationId,'published-test','{}']), /permission denied/);
      await role('anon');
      await assert.rejects(db.query('SELECT public.publish_organization_application($1,$2,$3::jsonb)',[applicationId,'published-test','{}']), /permission denied/);
    });
    await t.test('consent and database length/coordinate checks cannot be bypassed', async () => {
      await role('authenticated',a);
      await assert.rejects(db.query("INSERT INTO public.organization_applications(applicant_id,client_request_id,title,city,category,address,description,source_note,consent_accepted,consent_version) VALUES ($1,gen_random_uuid(),'t','c','c','a','d','s',false,'ORG-APPLICATION-1.0')",[a]), /check constraint|row-level security/);
      await assert.rejects(insert(a,request), /duplicate key/);
      await role('service_role');
      await assert.rejects(db.query("UPDATE public.organizations SET latitude=91,longitude=92 WHERE id='private-draft'"), /check constraint/);
      await assert.rejects(db.query("UPDATE public.organizations SET title=repeat('a',161) WHERE id='private-draft'"), /check constraint/);
      await assert.rejects(db.query("UPDATE public.organizations SET title='a' || repeat(' ',161) WHERE id='private-draft'"), /check constraint/);
    });
    await t.test('failed publication rolls back organization and leaves pending request', async () => {
      await role('service_role');
      const invalid = {title:'Invalid',city:'Test',category:'Test',description:'Test',source_type:'manual_verified',verified_at:'2026-10-06',latitude:91,longitude:10};
      await assert.rejects(db.query('SELECT public.publish_organization_application($1,$2,$3::jsonb)', [applicationId,'failed-publication',JSON.stringify(invalid)]), /check constraint/);
      assert.equal((await db.query("SELECT * FROM public.organizations WHERE id='failed-publication'")).rows.length,0);
      assert.equal((await db.query('SELECT status FROM public.organization_applications WHERE id=$1',[applicationId])).rows[0].status,'pending');
    });
    await t.test('trusted moderation publishes reviewed fields atomically and retains legacy ID', async () => {
      await role('service_role');
      const fields = {title:'Памятник основателям города Енисейска',city:'Енисейск',category:'Достопримечательности',description:'Памятник, посвящённый основателям Енисейска.',source_type:'user_provided',verified_at:'2026-10-06'};
      await db.query('SELECT public.publish_organization_application($1,$2,$3::jsonb,$4)',[applicationId,'place-founders-monument',JSON.stringify(fields),'Рассмотрено в изолированном тесте']);
      await assert.rejects(db.query('SELECT public.publish_organization_application($1,$2,$3::jsonb)',[applicationId,'place-founders-monument',JSON.stringify(fields)]), /already reviewed/);
      await role('authenticated',a);
      const row = (await db.query('SELECT status,organization_id FROM public.organization_applications')).rows[0];
      assert.equal(row.status,'approved'); assert.equal(row.organization_id,'place-founders-monument');
      await role('anon'); assert.equal((await db.query('SELECT * FROM public.organizations')).rows.length,8);
    });
    await t.test('same natural organization cannot be inserted with a new ID', async () => {
      await role('service_role');
      await assert.rejects(db.query("INSERT INTO public.organizations(id,city,title,category,description,source_type) SELECT 'duplicate',city,title,category,description,source_type FROM public.organizations WHERE id='place-founders-monument'"), /duplicate key/);
    });
  } finally { await db.close(); }
});
