import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateClosedBetaEnvironment } from './closed-beta-env.mjs';

validateClosedBetaEnvironment(process.env);
const root = 'dist';
const html = await readFile(join(root, 'index.html'), 'utf8');
assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive, nosnippet"\s*\/>/);
assert.match(html, /<meta name="referrer" content="no-referrer"\s*\/>/);
assert.doesNotMatch(html, /<link rel="canonical"/);
assert.doesNotMatch(html, /"@type":\s*"WebSite"/);
assert.doesNotMatch(html, /metrika-noscript-start/);
assert.doesNotMatch(html, /VITE_SUPABASE_PUBLISHABLE_KEY/);
assert.doesNotMatch(html, /cptbmepnbzogqkfhflsg/);

const files = (await readdir(join(root, 'assets'))).filter(file => file.endsWith('.js'));
assert(files.length, 'No compiled JavaScript assets');
const compiled = (await Promise.all(files.map(file => readFile(join(root, 'assets', file), 'utf8')))).join('\n');
assert(compiled.includes('djqhixvlfsbvannoqdjw.supabase.co'), 'Test Supabase URL missing from bundle');
assert(!compiled.includes('cptbmepnbzogqkfhflsg.supabase.co'), 'Production Supabase URL embedded in beta bundle');
await writeFile(join(root, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
assert.equal(await readFile(join(root, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
console.log('Verified beta artifact: test backend, noindex, no canonical, robots disallow, no production Supabase URL.');
