import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const [vite, notice, cachePolicy, app] = await Promise.all([
  readFile('vite.config.ts', 'utf8'),
  readFile('src/components/SiteUpdateNotice.tsx', 'utf8'),
  readFile('public/.htaccess', 'utf8'),
  readFile('src/App.tsx', 'utf8'),
]);

test('the emitted version endpoint and the HTML meta use the same build ID', () => {
  assert.match(vite, /name: 'ryadom-release-version'/);
  assert.match(vite, /name="ryadom-build-version"/);
  assert.match(vite, /fileName: 'version.json'/);
  assert.match(vite, /source: JSON.stringify\(\{ version: buildId \}\)/);
});

test('the update check is cache-busting, infrequent, and respects interrupted network', () => {
  assert.match(notice, /cache: 'no-store'/);
  assert.match(notice, /CHECK_INTERVAL_MS = 5 \* 60 \* 1000/);
  assert.match(notice, /visibilitychange/);
  assert.match(notice, /window\.addEventListener\('focus'/);
  assert.match(notice, /controller\.abort\(\)/);
  assert.match(notice, /window\.clearInterval\(timer\)/);
});

test('visitors choose when to reload; we do not interrupt unsaved forms', () => {
  assert.match(notice, /onClick=\{\(\) => window\.location\.reload\(\)\}/);
  assert.match(notice, /onClick=\{\(\) => setDismissedVersion\(availableVersion\)\}/);
  assert.match(app, /<SiteUpdateNotice\/>/);
  assert.doesNotMatch(notice, /setInterval\(\(\) => window\.location\.reload/);
});

test('production HTML and the version manifest are uncached', () => {
  assert.match(cachePolicy, /index\\\.html\|version\\\.json/);
  assert.match(cachePolicy, /no-store/);
  assert.match(cachePolicy, /immutable/);
});
