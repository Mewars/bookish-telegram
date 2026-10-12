import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { readTheme } from '../src/utils/theme.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

for (const raw of [null, '', 'light', 'dark', 'system', '"light"', '"dark"', '"system"', '"invalid"', '{', '{}', 'null', 'false']) {
  for (const systemDark of [false, true]) {
    test(`pre-paint and React agree for ${JSON.stringify(raw)}, system dark=${systemDark}`, () => {
      const storage = { getItem: key => { assert.equal(key, 'ryadom.theme'); return raw; } };
      const document = { documentElement: { dataset: {} } };
      runInNewContext(script, { localStorage: storage, document, window: { matchMedia: query => {
        assert.equal(query, '(prefers-color-scheme: dark)');
        return { matches: systemDark };
      } } });
      globalThis.localStorage = storage;
      try {
        const preference = readTheme();
        const expectedPreference = ['light', 'dark', 'system'].find(value => raw === value || raw === JSON.stringify(value)) ?? 'system';
        assert.equal(preference, expectedPreference);
        assert.equal(document.documentElement.dataset.theme, preference === 'system' ? (systemDark ? 'dark' : 'light') : preference);
      } finally { delete globalThis.localStorage; }
    });
  }
}

test('blocked storage follows the system without breaking startup', () => {
  const storage = { getItem: () => { throw new Error('SecurityError'); } };
  const document = { documentElement: { dataset: {} } };
  runInNewContext(script, { localStorage: storage, document, window: { matchMedia: () => ({ matches: true }) } });
  assert.equal(document.documentElement.dataset.theme, 'dark');
  globalThis.localStorage = storage;
  try { assert.equal(readTheme(), 'system'); } finally { delete globalThis.localStorage; }
});

test('missing matchMedia falls back safely and explicit dark still works', () => {
  for (const raw of [null, '"dark"']) {
    const document = { documentElement: { dataset: {} } };
    runInNewContext(script, { localStorage: { getItem: () => raw }, document, window: {} });
    assert.equal(document.documentElement.dataset.theme, raw ? 'dark' : 'light');
  }
});

test('critical styles precede the app and match the design tokens', () => {
  assert.ok(html.indexOf('<script>') < html.indexOf('<style>'));
  assert.ok(html.indexOf('<style>') < html.indexOf('type="module"'));
  const styles = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  for (const color of ['#FAF7EF', '#0B1C29', '#071622', '#FFF8E9']) {
    assert.ok(styles.includes(color));
    assert.ok(tokens.includes(color));
  }
});
