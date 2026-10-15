import assert from 'node:assert/strict';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const TEST_BACKEND_ORIGIN = 'djqhixvlfsbvannoqdjw.supabase.co';
const PRODUCTION_BACKEND_ID = 'cptbmepnbzogqkfhflsg';
const TEXT_EXTENSIONS = /\.(?:js|mjs|css|html|json|txt|xml|svg|webmanifest)$/i;

async function listFiles(directory) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const absolute = join(path, entry.name);
      // Symlinks must never be packaged: they can expose files outside the build.
      assert(!entry.isSymbolicLink(), 'Closed beta package contains a symbolic link');
      if (entry.isDirectory()) await visit(absolute);
      else {
        assert(entry.isFile(), 'Closed beta package contains an unexpected filesystem entry');
        files.push(absolute);
      }
    }
  }
  assert((await lstat(directory)).isDirectory(), 'Closed beta output directory is missing');
  await visit(directory);
  return files;
}

// Inspect the entire deployable tree, not just top-level JavaScript chunks.
// Return only counts; never log the contents of browser publishable keys.
export async function auditClosedBetaAssetTree(directory = 'dist') {
  const files = await listFiles(directory);
  const javascript = files.filter(path => /\.(?:js|mjs)$/i.test(path));
  assert(javascript.length > 0, 'Closed beta package has no JavaScript');
  let foundTestBackend = false;
  let scannedFiles = 0;
  for (const file of files) {
    if (!TEXT_EXTENSIONS.test(file)) continue;
    const name = relative(directory, file);
    const contents = await readFile(file, 'utf8');
    assert(!contents.includes(PRODUCTION_BACKEND_ID),
      'Closed beta asset ' + name + ' references the production Supabase project');
    assert(!/sb_secret_[A-Za-z0-9_-]+/.test(contents),
      'Closed beta asset ' + name + ' exposes a Supabase secret key');
    assert(!/\b(?:SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_PUBLISHABLE_KEY)\b/.test(contents),
      'Closed beta asset ' + name + ' contains an unresolved configuration variable');
    if (/\.(?:js|mjs)$/i.test(file) && contents.includes(TEST_BACKEND_ORIGIN)) {
      foundTestBackend = true;
    }
    scannedFiles += 1;
  }
  assert(foundTestBackend, 'Closed beta JavaScript does not contain the exact Ryadom-Test backend');
  return { scannedFiles, javascriptFiles: javascript.length };
}
