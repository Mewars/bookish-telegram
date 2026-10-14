import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { navigateToRoute } from '../src/hooks/useRoute.ts';

test('clicking logo scrolls to top even when already on home and hash does not change', () => {
  const oldWindow = globalThis.window;
  const scrolls = [];
  const mock = {
    location: { hash: '#/home' },
    scrollTo: options => scrolls.push(options),
  };
  globalThis.window = mock;
  try {
    navigateToRoute('home');
    assert.deepEqual(scrolls, [{ top: 0, left: 0, behavior: 'instant' }]);
    assert.equal(mock.location.hash, '#/home');

    // From a catalog or profile page the logo also scrolls immediately.
    mock.location.hash = '#/places';
    navigateToRoute('home');
    assert.equal(mock.location.hash, '#/home');
    assert.equal(scrolls.length, 2);
    assert.deepEqual(scrolls[1], { top: 0, left: 0, behavior: 'instant' });

    // A repeated click on the same navigation section also returns to top.
    mock.location.hash = '#/places';
    navigateToRoute('places');
    assert.equal(scrolls.length, 3);

    // Normal navigation to a different section remains unchanged.
    mock.location.hash = '#/events';
    navigateToRoute('places');
    assert.equal(mock.location.hash, '#/places');
    assert.equal(scrolls.length, 3);
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
});

test('both top logo buttons and footer logo use the same route navigation', async () => {
  const app = await readFile('src/App.tsx', 'utf8');
  const desktopHeader = await readFile('src/components/web/WebHeader.tsx', 'utf8');
  const desktopFooter = await readFile('src/components/web/WebFooter.tsx', 'utf8');
  const footerBrand = await readFile('src/components/FooterBrand.tsx', 'utf8');
  assert.match(app, /className="brand brand-logo-pin" onClick=\{\(\) => navigate\('home'\)\}/);
  assert.match(desktopHeader, /className="brand brand-logo-pin" onClick=\{\(\) => navigate\('home'\)\}/);
  assert.match(desktopFooter, /goHome=\{\(\) => navigate\('home'\)\}/);
  assert.match(footerBrand, /onClick=\{goHome\}/);
});
