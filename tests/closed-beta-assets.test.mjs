import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { auditClosedBetaAssetTree } from '../scripts/audit-closed-beta-assets.mjs';

const TEST_ORIGIN = 'https://djqhixvlfsbvannoqdjw.supabase.co';
const PRODUCTION_PROJECT = 'cptbmepnbzogqkfhflsg';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ryadom-beta-artifacts-'));
  await mkdir(join(root, 'assets', 'nested'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<meta name="robots" content="noindex">');
  await writeFile(join(root, 'assets', 'index.js'), 'const backend = "' + TEST_ORIGIN + '";');
  await writeFile(join(root, 'assets', 'nested', 'lazy.js'), 'export default "test";');
  await writeFile(join(root, 'assets', 'nested', 'style.css'), '.test{display:block}');
  return root;
}

async function withFixture(run) {
  const root = await fixture();
  try { await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('audits all nested JS/CSS/HTML assets rather than only entry chunks', async () => {
  await withFixture(async root => {
    const result = await auditClosedBetaAssetTree(root);
    assert.equal(result.javascriptFiles, 2);
    assert.equal(result.scannedFiles, 4);
  });
});

test('fails closed if a lazy chunk, CSS, JSON or HTML contains production backend ID', async () => {
  for (const rel of ['assets/nested/lazy.js', 'assets/nested/style.css', 'version.json', 'index.html']) {
    await withFixture(async root => {
      await writeFile(join(root, rel), 'bad project ' + PRODUCTION_PROJECT);
      await assert.rejects(() => auditClosedBetaAssetTree(root), /production Supabase project/);
    });
  }
});

test('rejects accidental secret key or unresolved environment variable in nested asset', async () => {
  for (const content of ['sb_secret_1234567890123456', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY']) {
    await withFixture(async root => {
      await writeFile(join(root, 'assets', 'nested', 'lazy.js'), content);
      await assert.rejects(() => auditClosedBetaAssetTree(root), /secret key|configuration variable/);
    });
  }
});

test('rejects missing test Supabase origin even when JavaScript exists', async () => {
  await withFixture(async root => {
    await writeFile(join(root, 'assets', 'index.js'), 'console.log("missing backend");');
    await assert.rejects(() => auditClosedBetaAssetTree(root), /exact Ryadom-Test backend/);
  });
});

test('rejects symlinks instead of dereferencing potentially external assets', async () => {
  await withFixture(async root => {
    const { symlink } = await import('node:fs/promises');
    await symlink(join(root, 'index.html'), join(root, 'assets', 'nested', 'unsafe.txt'));
    await assert.rejects(() => auditClosedBetaAssetTree(root), /symbolic link/);
  });
});
