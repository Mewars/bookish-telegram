/* global URL, Response, Buffer */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditClosedBetaHost, parseBetaOrigin } from '../scripts/audit-closed-beta-host.mjs';

const origin = 'https://beta.ryadomcity.ru';
const expectedSha = 'a'.repeat(40);
const html = '<html><head><meta name="robots" content="noindex, nofollow, noarchive, nosnippet"/></head>' +
  '<body><link rel="stylesheet" href="/assets/index-123.css"><script type="module" src="/assets/index-123.js"></script></body></html>';

function mockFetch({ publicPath, redirect, cacheable, wrongSha, exposeScript, missingRobots, exposeCss, allowWrongBasic, noStylesheet, wrongCssType, cssProductionId } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const u = new URL(url);
    const auth = options.headers.Authorization;
    const valid = auth === `Basic ${Buffer.from('beta:private').toString('base64')}`;
    if (auth && !valid && !allowWrongBasic) return new Response('denied', { status: 401 });
    calls.push({ path: u.pathname, authenticated: !!options.headers.Authorization, redirect: options.redirect });
    if (!auth) {
      if (redirect && u.pathname === '/') return new Response('', { status: 302, headers: { Location: 'https://elsewhere.test' } });
      if (publicPath === u.pathname || (exposeScript && u.pathname.endsWith('.js')) || (exposeCss && u.pathname.endsWith('.css'))) return new Response('exposed');
      return new Response('blocked', { status: 401 });
    }
    if (u.pathname === '/robots.txt') return new Response(missingRobots ? 'User-agent: *\nAllow: /' : 'User-agent: *\nDisallow: /');
    if (u.pathname === '/version.json') return Response.json({ version: wrongSha ? 'b'.repeat(40) : expectedSha });
    if (u.pathname.endsWith('.js')) return new Response('console.log("test")');
    if (u.pathname.endsWith('.css')) return new Response(cssProductionId ? 'cptbmepnbzogqkfhflsg' : 'body{color:black}', { headers: { 'Content-Type': wrongCssType ? 'text/html' : 'text/css' } });
    return new Response(noStylesheet ? html.replace(/<link[^>]+>/, '') : html, { headers: { 'Content-Type': 'text/html', 'Cache-Control': cacheable ? 'public,max-age=3600' : 'private, no-store' } });
  };
  return { fetchImpl, calls };
}

function audit(fetchImpl) {
  return auditClosedBetaHost({ origin, username: 'beta', password: 'private', expectedSha, fetchImpl });
}

test('allows only canonical isolated HTTPS subdomains, never production or inline passwords', () => {
  assert.equal(parseBetaOrigin(origin), origin);
  for (const value of [
    'https://ryadomcity.ru', 'https://www.ryadomcity.ru', 'http://beta.ryadomcity.ru',
    'https://beta.ryadomcity.ru.evil.test', 'https://beta.ryadomcity.ru/path',
    'https://user:pass@beta.ryadomcity.ru', 'https://beta.ryadomcity.ru/#/classifieds',
    'https://beta.ryadomcity.ru:8443', 'https://localhost',
  ]) assert.throws(() => parseBetaOrigin(value), value);
});

test('checks denied root/static routes, authorized HTML and JS, noindex, robots and commit SHA', async () => {
  const { fetchImpl, calls } = mockFetch();
  const result = await audit(fetchImpl);
  assert.equal(result.checkedUnauthenticatedPaths, 10);
  assert(calls.every(call => call.redirect === 'manual'));
  assert(calls.some(call => call.path === '/assets/index-123.js' && !call.authenticated));
  assert(calls.some(call => call.path === '/version.json' && call.authenticated));
});

test('rejects exposed static routes, redirect to login, and exposed hashed JS bundle', async () => {
  for (const opts of [{ publicPath: '/robots.txt' }, { publicPath: '/version.json' },
    { redirect: true }, { exposeScript: true }]) {
    await assert.rejects(() => audit(mockFetch(opts).fetchImpl), /Unauthenticated request/);
  }
});

test('rejects cacheable HTML, wrong deployed version and invalid host credentials', async () => {
  await assert.rejects(() => audit(mockFetch({ cacheable: true }).fetchImpl), /non-cacheable/);
  await assert.rejects(() => audit(mockFetch({ wrongSha: true }).fetchImpl), /SHA does not match/);
  await assert.rejects(() => auditClosedBetaHost({ origin, username: '', password: '', expectedSha, fetchImpl: mockFetch().fetchImpl }), /credentials/);
});

test('rejects exposed CSS, incorrect Basic credentials, missing CSS and production identifiers', async () => {
  for (const opts of [{ exposeCss: true }, { allowWrongBasic: true }, { noStylesheet: true }, { wrongCssType: true }, { cssProductionId: true }]) {
    await assert.rejects(() => audit(mockFetch(opts).fetchImpl));
  }
});
