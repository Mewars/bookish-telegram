import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

test('reviewed Eniseysk records: 17 source-backed entries and two content sections', async () => {
  const source = await readFile('src/data/verifiedEniseysk.ts', 'utf8');
  const blocks = [...source.matchAll(/\{\s*\.\.\.common,[\s\S]*?\n\s{2}\},/g)].map(match => match[0]);
  const ids = blocks.map(block => block.match(/\bid: '([^']+)'/)?.[1]);
  assert.equal(blocks.length, 17);
  assert.equal(new Set(ids).size, 17);
  assert.equal(blocks.filter(block => block.includes("kind: 'places'")).length, 15);
  assert.equal(blocks.filter(block => block.includes("kind: 'services'")).length, 2);
  for (const block of blocks) {
    const id = block.match(/\bid: '([^']+)'/)?.[1];
    const url = block.match(/\bsourceUrl: '([^']+)'/)?.[1];
    const address = block.match(/\baddress: '([^']+)'/)?.[1];
    const description = block.match(/\bdescription: '([^']+)'/)?.[1];
    assert.ok(id && address && description && url, 'Entry missing source/address: ' + id);
    assert.equal(new URL(url).protocol, 'https:');
    assert.doesNotMatch(block, /\b(?:rating|coordinates|dateOffset|time):/);
    assert.doesNotMatch(block, /https?:\/\/[^'\s]*\.(png|jpe?g|webp)/);
  }
  assert.doesNotMatch(source, /Блинная Изба|Кафе «Притчи»/);
  const catalog = await readFile('src/data/catalog.ts', 'utf8');
  assert.match(catalog, /\.\.\.verifiedEniseyskPlaces, \.\.\.verifiedEniseyskServices/);
});

test('prepared SQL seed matches 17 entries, is idempotent and protected by RLS', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;`);
    await db.exec(await readFile('docs/sql/organizations.sql','utf8'));
    await db.exec(await readFile('docs/sql/organizations-seed.sql','utf8'));
    const entries = await readFile('docs/sql/organizations-seed-reviewed-2026-10.sql','utf8');
    await db.exec(entries);
    await db.exec(entries);
    await db.exec('SET SESSION AUTHORIZATION anon');
    const result = await db.query('SELECT id, kind, status, source_url FROM public.organizations ORDER BY id');
    assert.equal(result.rows.length, 25);
    assert.equal(result.rows.filter(row => row.kind === 'services').length, 2);
    assert.equal(result.rows.filter(row => row.kind === 'places').length, 23);
    assert.ok(result.rows.every(row => row.status === 'published'));
    assert.ok(result.rows.filter(row => row.source_url).every(row => new URL(row.source_url).protocol === 'https:'));
    await assert.rejects(db.exec("INSERT INTO public.organizations(id,city,title,category,description,source_type) VALUES ('fake','Енисейск','Fake','C','D','user_provided')"), /permission denied/);
  } finally {
    await db.close();
  }
});


test('interactive admin preview cannot connect to Supabase and is Netlify-only', async () => {
  const app = await readFile('src/App.tsx', 'utf8');
  const demo = await readFile('src/admin/AdminPreviewPage.tsx', 'utf8');
  assert.match(app, /hostname\.endsWith\('\.netlify\.app'\)/);
  assert.match(app, /adminPreviewEnabled \? <AdminPreviewPage/);
  assert.doesNotMatch(demo, /import .*supabase|readCityAccess|saveAdminOrganization|uploadAdminPhoto|fetch\(/i);
  assert.match(demo, /Демонстрационный режим/);
  assert.match(demo, /Сохранить в демо/);
});
