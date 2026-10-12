import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startWebsiteOAuth } from '../src/auth/oauth.ts';
import { oauthFailure } from '../src/auth/oauthCallback.ts';
import { authStorage } from '../src/lib/authStorage.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { URL } from 'node:url';

test('frontend has no obsolete SDK loader, launch checks, WebApp types or handlers', () => {
  const inspect = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) inspect(url);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        assert.doesNotMatch(readFileSync(url, 'utf8'), /TelegramWebApp|window\.Telegram|telegram-web-app\.js|useTelegram|__telegram__initParams|tgWebApp|BackButton|initDataUnsafe/);
      }
    }
  };
  inspect(new URL('../src/', import.meta.url));
});

test('persisted Supabase session excludes upstream provider tokens', () => {
  const stored = new Map();
  globalThis.localStorage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key),
  };
  try {
    authStorage.setItem('fixture-session', JSON.stringify({
      access_token: 'supabase-session', refresh_token: 'supabase-refresh',
      provider_token: 'upstream-secret', provider_refresh_token: 'upstream-refresh',
      user: { id: 'stable-account' },
    }));
    assert.deepEqual(JSON.parse(stored.get('fixture-session')), {
      access_token: 'supabase-session', refresh_token: 'supabase-refresh', user: { id: 'stable-account' },
    });
    authStorage.removeItem('fixture-session');
  } finally { delete globalThis.localStorage; }
});

test('callback cancellation routes to login and strips sensitive parameters', () => {
  const result = oauthFailure('https://ryadomcity.ru/?error=access_denied&error_description=UNTRUSTED&state=secret&code=secret#access_token=secret');
  assert.equal(result.url, 'https://ryadomcity.ru/#/login');
  assert.match(result.message, /отменён/);
  assert.ok(!result.message.includes('UNTRUSTED'));
});

test('malformed callback does not expose provider text or tokens', () => {
  const result = oauthFailure('https://ryadomcity.ru/#error=server_error&error_description=UNTRUSTED&provider_token=secret');
  assert.equal(result.url, 'https://ryadomcity.ru/#/login');
  assert.match(result.message, /Не удалось/);
});

test('successful callbacks and ordinary routes stay under Supabase control', () => {
  assert.equal(oauthFailure('https://ryadomcity.ru/?code=valid'), null);
  assert.equal(oauthFailure('https://ryadomcity.ru/#/places'), null);
});

for (const [provider, expected] of [['vk', 'custom:vk'], ['yandex', 'custom:yandex']]) {
  test(`${provider} delegates OAuth and session creation to Supabase`, async () => {
    const result = { data: { url: 'https://auth.example/authorize' }, error: null };
    const client = { auth: { signInWithOAuth: async options => {
      assert.deepEqual(options, { provider: expected, options: { redirectTo: 'https://ryadomcity.ru/' } });
      return result;
    } } };
    assert.equal(await startWebsiteOAuth(client, provider, 'https://ryadomcity.ru/'), result);
  });
}

test('provider errors are returned to the UI without inventing a session', async () => {
  const error = new Error('Provider unavailable');
  const client = { auth: { signInWithOAuth: async () => ({ data: { url: null }, error }) } };
  assert.equal((await startWebsiteOAuth(client, 'vk', 'https://ryadomcity.ru/')).error, error);
});

test('network rejection stays actionable', async () => {
  const client = { auth: { signInWithOAuth: async () => { throw new Error('Network offline'); } } };
  await assert.rejects(startWebsiteOAuth(client, 'vk', 'https://ryadomcity.ru/'), /Network offline/);
});
