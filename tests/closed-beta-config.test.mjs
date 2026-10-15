import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { isRyadomTestBackend, RYADOM_TEST_SUPABASE_ORIGIN } from '../src/config/betaBackend.ts';
import { validateClosedBetaEnvironment } from '../scripts/closed-beta-env.mjs';

const flags = {
  CONTEXT: 'closed-beta',
  VITE_SUPABASE_URL: RYADOM_TEST_SUPABASE_ORIGIN,
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_test_key_for_unit_checks',
  VITE_CLASSIFIEDS_ENABLED: 'true',
  VITE_COMMUNITY_ENABLED: 'true',
  VITE_BETA_EMAIL_ONLY: 'true',
  VITE_VK_ID_ENABLED: 'false',
  VITE_ADMIN_PANEL_ENABLED: 'false',
  VITE_CARD_PHOTOS_ENABLED: 'false',
  VITE_CITY_DIRECTORY_ENABLED: 'false',
  VITE_ORGANIZATIONS_ENABLED: 'false',
};

test('only the canonical Ryadom-Test Supabase origin unlocks beta routes', () => {
  assert.equal(isRyadomTestBackend(RYADOM_TEST_SUPABASE_ORIGIN), true);
  const untrusted = [
    undefined, null, '', 'http://djqhixvlfsbvannoqdjw.supabase.co',
    'https://cptbmepnbzogqkfhflsg.supabase.co',
    'https://djqhixvlfsbvannoqdjw.supabase.co.attacker.test',
    'https://attacker.test/djqhixvlfsbvannoqdjw',
    'https://user:pass@djqhixvlfsbvannoqdjw.supabase.co',
    'https://djqhixvlfsbvannoqdjw.supabase.co/auth/v1',
    'https://djqhixvlfsbvannoqdjw.supabase.co/?next=production',
    'https://djqhixvlfsbvannoqdjw.supabase.co/#/login',
    'https://djqhixvlfsbvannoqdjw.supabase.co.evil.com',
  ];
  for (const url of untrusted) assert.equal(isRyadomTestBackend(url), false, String(url));
});

test('a closed beta package rejects production, missing credentials and unsafe switches', () => {
  assert.equal(validateClosedBetaEnvironment(flags), true);
  const edits = [
    {CONTEXT: 'production'},
    {VITE_SUPABASE_URL: 'https://cptbmepnbzogqkfhflsg.supabase.co'},
    {VITE_SUPABASE_URL: 'https://djqhixvlfsbvannoqdjw.supabase.co.evil.test'},
    {VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_a_public_key_123456'},
    {VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiJ9'},
    {VITE_SUPABASE_PUBLISHABLE_KEY: ''},
    {VITE_CLASSIFIEDS_ENABLED: 'false'}, {VITE_COMMUNITY_ENABLED: 'false'},
    {VITE_BETA_EMAIL_ONLY: 'false'}, {VITE_VK_ID_ENABLED: 'true'},
    {VITE_ADMIN_PANEL_ENABLED: 'true'}, {VITE_ORGANIZATIONS_ENABLED: 'true'},
    {VITE_CARD_PHOTOS_ENABLED: 'true'}, {VITE_CITY_DIRECTORY_ENABLED: 'true'},
  ];
  for (const patch of edits) {
    assert.throws(() => validateClosedBetaEnvironment({...flags,...patch}), /closed.beta|Unsafe/i,
      JSON.stringify(patch).replace(/sb_publishable_[^"]+/, '[public key]'));
  }
});

test('production and test flows cannot silently share Supabase feature flags', async () => {
  const [app, page, seo, vite, packageJson, providers] = await Promise.all([
    readFile('src/App.tsx', 'utf8'),
    readFile('tests/classifieds-beta.test.mjs', 'utf8'),
    readFile('src/seo/usePageMetadata.ts', 'utf8'),
    readFile('vite.config.ts', 'utf8'),
    readFile('package.json', 'utf8'),
    readFile('src/auth/providers.ts', 'utf8'),
  ]);
  assert.match(app, /isRyadomTestBackend\(import\.meta\.env\.VITE_SUPABASE_URL\)/);
  assert.match(app, /VITE_CLASSIFIEDS_ENABLED === 'true' && testBackend/);
  assert.match(app, /VITE_COMMUNITY_ENABLED === 'true' && testBackend/);
  assert.doesNotMatch(app, /VITE_SUPABASE_URL\?\.includes/);
  assert.match(page, /isRyadomTestBackend/);
  assert.match(vite, /name: 'ryadom-closed-beta-noindex'/);
  assert.match(vite, /noindex, nofollow, noarchive, nosnippet/);
  assert.match(seo, /VITE_BETA_EMAIL_ONLY === 'true'/);
  assert.match(providers, /VITE_BETA_EMAIL_ONLY !== 'true'/);
  assert.match(providers, /VITE_BETA_EMAIL_ONLY === 'true'/);
  assert.match(packageJson, /scripts\/check-closed-beta-env\.mjs/);
  assert.match(packageJson, /scripts\/verify-closed-beta-dist\.mjs/);
});
