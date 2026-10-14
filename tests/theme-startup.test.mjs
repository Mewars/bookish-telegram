import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { readTheme, resolveTheme } from '../src/utils/theme.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const samples = [null, '', 'light', 'dark', 'system', '"light"', '"dark"', '"system"', '"invalid"', '{', '{}', 'null', 'false'];

for (const raw of samples) {
  for (const systemDark of [false, true]) {
    for (const compact of [false, true]) {
      test('pre-paint matches React for ' + JSON.stringify(raw) + ', systemDark=' + systemDark + ', compact=' + compact, () => {
        const storage = { getItem: key => { assert.equal(key, 'ryadom.theme'); return raw; } };
        const document = { documentElement: { dataset: {} } };
        runInNewContext(script, { localStorage: storage, document, window: { matchMedia: query => {
          if (query === '(prefers-color-scheme: dark)') return { matches: systemDark };
          assert.equal(query, '(max-width: 899px)');
          return { matches: compact };
        } } });
        globalThis.localStorage = storage;
        try {
          const preference = readTheme();
          const expectedPreference = ['light', 'dark', 'system'].find(value => raw === value || raw === JSON.stringify(value)) ?? 'system';
          assert.equal(preference, expectedPreference);
          assert.equal(document.documentElement.dataset.theme, resolveTheme(preference, systemDark ? 'dark' : 'light', compact));
        } finally { delete globalThis.localStorage; }
      });
    }
  }
}

test('blocked storage falls back to system mode on desktop and dark on mobile', () => {
  const storage = { getItem: () => { throw new Error('SecurityError'); } };
  globalThis.localStorage = storage;
  try { assert.equal(readTheme(), 'system'); } finally { delete globalThis.localStorage; }
  for (const compact of [false, true]) {
    const document = { documentElement: { dataset: {} } };
    runInNewContext(script, { localStorage: storage, document, window: { matchMedia: query => ({ matches: query === '(max-width: 899px)' ? compact : false }) } });
    assert.equal(document.documentElement.dataset.theme, compact ? 'dark' : 'light');
  }
});

test('missing matchMedia does not break startup', () => {
  const document = { documentElement: { dataset: {} } };
  runInNewContext(script, { localStorage: { getItem: () => '"dark"' }, document, window: {} });
  assert.equal(document.documentElement.dataset.theme, 'dark');
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
