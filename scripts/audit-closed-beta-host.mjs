/* global process, console, fetch, AbortSignal, URL */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

const PRODUCTION_BACKEND_ID = 'cptbmepnbzogqkfhflsg';

export function parseBetaOrigin(raw) {
  assert.equal(typeof raw, 'string', 'Beta origin is required');
  const url = new URL(raw);
  assert.equal(url.protocol, 'https:', 'Beta host must use HTTPS');
  assert.equal(url.port, '', 'Beta host must use standard HTTPS port');
  assert(!url.username && !url.password, 'Credentials must not appear in the beta URL');
  assert.equal(url.pathname, '/', 'Beta origin must not contain a path');
  assert(!url.search && !url.hash, 'Beta origin must not contain a query or fragment');
  assert(raw === url.origin || raw === `${url.origin}/`, 'Specify an exact, canonical HTTPS origin');
  assert(url.hostname.endsWith('.ryadomcity.ru') &&
    !['www.ryadomcity.ru', 'ryadomcity.ru'].includes(url.hostname),
  'Beta must be hosted on a dedicated ryadomcity.ru subdomain, never production');
  return url.origin;
}

function assertDenied(response, path) {
  assert([401, 403].includes(response.status),
    `Unauthenticated request ${path} returned ${response.status}; expected 401/403 from the host gate`);
}

export async function auditClosedBetaHost({ origin: rawOrigin, username, password, expectedSha, fetchImpl = fetch }) {
  const origin = parseBetaOrigin(rawOrigin);
  assert(username && password, 'Dedicated host HTTP Basic Auth credentials are required');
  assert.match(expectedSha || '', /^[a-f0-9]{40}$/i, 'Expected build commit SHA must be 40 hex characters');

  const encodeBasic = (user, pass) => `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`;
  const basic = encodeBasic(username, password);
  const invalidCredentials = [encodeBasic(`${username}-invalid-probe`, password), encodeBasic(username, `${password}-invalid-probe`)];
  const request = async (path, authenticated, overrideAuthorization) => fetchImpl(origin + path, {
    method: 'GET',
    redirect: 'manual', // Never forward Basic credentials across redirects.
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-store',
      ...(authenticated ? { Authorization: overrideAuthorization || basic } : {}),
    },
    signal: AbortSignal.timeout(12000),
  });

  // A missing file must also be gated: checking only / would miss exposed static assets.
  const deniedPaths = ['/', '/index.html', '/robots.txt', '/version.json',
    '/assets/__ryadom_access_probe__.js', '/brand/pin-yellow.svg'];
  for (const path of deniedPaths) assertDenied(await request(path, false), path);

  for (const invalid of invalidCredentials) assertDenied(await request('/', true, invalid), 'invalid HTTP Basic credentials');

  const htmlResponse = await request('/', true);
  assert.equal(htmlResponse.status, 200, 'Authorized request to beta HTML must return 200');
  assert.match(htmlResponse.headers.get('content-type') || '', /text\/html/i,
    'Authenticated root must serve HTML');
  assert.match(htmlResponse.headers.get('cache-control') || '', /no-store/i,
    'Authenticated beta HTML must be non-cacheable');
  const html = await htmlResponse.text();
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive, nosnippet"\s*\/>/,
    'Deployed beta HTML is missing the noindex guard');
  assert.doesNotMatch(html, /<link rel="canonical"/i, 'Beta must not advertise a production canonical URL');
  assert.doesNotMatch(html, new RegExp(PRODUCTION_BACKEND_ID), 'Production backend ID found in beta HTML');

  // Include every entry and modulepreload, then follow bundled import/dependency
  // strings. Vite also lists lazy chunks in its generated dependency arrays.
  const scripts = new Map();
  const addScript = (value, base = origin) => {
    const url = new URL(value, base);
    assert(url.origin === origin && url.pathname.startsWith('/assets/'),
      'Beta JS assets must stay on the isolated same-origin /assets/ path');
    url.hash = '';
    scripts.set(url.href, url);
    assert(scripts.size <= 500, 'Beta JS dependency graph exceeds the audit limit');
  };
  for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const isScript = /^<script\b/i.test(tag[0]);
    const isPreload = /\brel=["']modulepreload["']/i.test(tag[0]);
    if (!isScript && !isPreload) continue;
    const attribute = isScript ? /\bsrc=["']([^"']+)["']/i : /\bhref=["']([^"']+)["']/i;
    const source = tag[0].match(attribute);
    if (source) addScript(source[1]);
  }
  assert(scripts.size > 0, 'Beta HTML must reference at least one same-origin JS bundle');
  // Map iteration visits newly discovered URLs; repeated/cyclic imports are deduplicated.
  for (const script of scripts.values()) {
    const path = script.pathname + script.search;
    assertDenied(await request(path, false), 'JS bundle');
    const scriptResponse = await request(path, true);
    assert.equal(scriptResponse.status, 200, 'Authorized JavaScript asset must load');
    assert.match(scriptResponse.headers.get('content-type') || '',
      /(?:text|application)\/(?:javascript|ecmascript)\b/i,
      'JS content type must be JavaScript');
    const js = await scriptResponse.text();
    assert(!js.includes(PRODUCTION_BACKEND_ID), 'Production backend ID found in JS bundle');
    assert(!/sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(js), 'Supabase secret found in JS bundle');
    for (const dependency of js.matchAll(/["'`]([^"'`\s]+\.js(?:\?[^"'`\s]*)?)["'`]/g)) {
      const value = dependency[1];
      const url = new URL(value, value.startsWith('assets/') ? `${origin}/` : script.href);
      if (url.origin === origin && url.pathname.startsWith('/assets/')) addScript(url.href);
    }
  }

  const styles = [...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css(?:\?[^"']*)?)["']/gi)]
    .map(match => new URL(match[1], origin))
    .filter(url => url.origin === origin && url.pathname.startsWith('/assets/'));
  assert(styles.length > 0, 'Beta HTML must reference at least one same-origin CSS bundle');
  for (const style of styles) {
    assertDenied(await request(style.pathname, false), 'CSS bundle');
    const cssResponse = await request(style.pathname, true);
    assert.equal(cssResponse.status, 200, 'Authorized CSS bundle must load');
    assert.match(cssResponse.headers.get('content-type') || '', new RegExp('text/css', 'i'), 'CSS content type must be text/css');
    const css = await cssResponse.text();
    assert(!css.includes(PRODUCTION_BACKEND_ID), 'Production backend ID found in CSS');
    assert(!/sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(css), 'Supabase secret found in CSS');
  }

  const robotsResponse = await request('/robots.txt', true);
  assert.equal(robotsResponse.status, 200, 'Authorized robots.txt must load');
  assert.match(await robotsResponse.text(), /User-agent:\s*\*\s*Disallow:\s*\//i,
    'Robots must disallow indexing');

  const versionResponse = await request('/version.json', true);
  assert.equal(versionResponse.status, 200, 'Authorized version.json must load');
  const version = await versionResponse.json();
  assert.equal(version.version, expectedSha, 'Deployed beta build SHA does not match approved commit');
  return { origin, checkedUnauthenticatedPaths: deniedPaths.length + scripts.size + styles.length + invalidCredentials.length, version: expectedSha, checkedJavaScriptAssets: scripts.size };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const result = await auditClosedBetaHost({
      origin: process.env.RYADOM_BETA_ORIGIN,
      username: process.env.RYADOM_BETA_BASIC_USER,
      password: process.env.RYADOM_BETA_BASIC_PASSWORD,
      expectedSha: process.env.RYADOM_BETA_EXPECTED_SHA,
    });
    console.log(`Closed beta host audit PASSED: ${result.checkedUnauthenticatedPaths} blocked paths, authenticated assets and SHA ${result.version}`);
  } catch (error) {
    console.error(`Closed beta host audit FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
