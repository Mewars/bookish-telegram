import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const file = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('detail links always use the actual item catalogue section, not home', async () => {
  const app = await file('src/App.tsx');
  assert.match(app, /const open = \(entry: Item\) => navigate\(entry\.kind, entry\.id\)/);
  assert.match(app, /goBack=\{\(\) => returnToCatalog\(item\.kind, city\)\}/);
  assert.doesNotMatch(app, /const open = \(entry: Item\) => navigate\(section, entry\.id\)/);
});

test('facts are actionable tiles, not a duplicate toolbar and repeated detail sidebar', async () => {
  const detail = await file('src/pages/DetailPage.tsx');
  const css = await file('src/styles/detail.css');
  for (const label of ['Адрес · открыть на карте', 'Телефон · позвонить', 'Режим работы', 'ИНФОРМАЦИЯ']) {
    assert.ok(detail.includes(label), `Missing tile: ${label}`);
  }
  assert.match(detail, /href=\{phoneHref\(item\.phone\)\}/);
  assert.match(detail, /href=\{maps\.mapsUrl\}/);
  assert.doesNotMatch(detail, /detail-mobile-actions|guide-detail-sidebar|detail-facts|detail-actions/);
  assert.match(css, /detail-contact-tiles/);
  assert.match(css, /object-fit:contain/);
});

test('mobile home image is uncropped, phone theme is dark and desktop theme is selectable', async () => {
  const css = await file('src/styles/home.css');
  const html = await file('index.html');
  const theme = await file('src/utils/theme.ts');
  const hook = await file('src/hooks/useTheme.ts');
  const app = await file('src/App.tsx');
  const profile = await file('src/pages/ProfilePage.tsx');
  assert.match(css, /aspect-ratio:\s*1400\s*\/\s*788/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /height:\s*auto/);
  assert.match(html, /max-width: 899px/);
  assert.match(html, /var dark = compact \|\|/);
  assert.match(theme, /return compact \? 'dark'/);
  assert.match(hook, /resolveTheme\(theme, systemScheme, compact\)/);
  assert.match(app, /useTheme\(!isWideScreen\)/);
  assert.match(profile, /allowThemeSelection && <section className="settings-card"/);
});

test('all 25 source-backed places get improved non-generic descriptions and SQL mirrors UI', async () => {
  const pairs = [
    ['src/data/places.ts', 'docs/sql/organizations-seed.sql', 8],
    ['src/data/verifiedEniseysk.ts', 'docs/sql/organizations-seed-reviewed-2026-10.sql', 17],
  ];
  const seen = new Set();
  for (const [path, sqlPath, count] of pairs) {
    const code = await file(path);
    const seed = await file(sqlPath);
    const blocks = [...code.matchAll(/\bid: '([^']+)'[\s\S]*?description: '([^']+)'/g)];
    assert.equal(blocks.length, count, path);
    for (const [, id, description] of blocks) {
      assert.ok(!seen.has(id), 'Duplicate ID: ' + id);
      seen.add(id);
      assert.ok(description.length >= 130, `Description too short for ${id}: ${description.length}`);
      assert.ok(description.length < 650, 'Description too long: ' + id);
      assert.ok(/Енисейск|Енисейска|Енисейске|енисейск/i.test(description), 'No town context: ' + id);
      assert.ok(seed.includes(description.replaceAll("'", "''")), 'SQL seed not aligned with card: ' + id);
    }
  }
  assert.equal(seen.size, 25);
});
