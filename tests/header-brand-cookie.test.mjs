import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = path => readFile(path, 'utf8');

test('cookie banner uses a transparent black bitten-cookie SVG beside its title', async () => {
  const [banner, icon, css, consent] = await Promise.all([
    read('src/privacy/CookieBanner.tsx'),
    read('src/privacy/CookieIcon.tsx'),
    read('src/privacy/cookieBanner.css'),
    read('src/privacy/cookieConsent.ts'),
  ]);
  assert.match(banner, /<h2 id="cookie-title" className="cookie-title"><CookieIcon size=\{28\}\/>/);
  assert.match(icon, /className="cookie-bite-icon"/);
  assert.match(icon, /viewBox="0 0 100 100"/);
  assert.match(icon, /aria-hidden="true"/);
  assert.match(icon, /fill="none"/);
  assert.match(icon, /currentColor/);
  assert.match(icon, /<circle cx=/);
  assert.doesNotMatch(icon, /<image|<rect|backgroundColor|background=/);
  assert.match(css, /\.cookie-banner \.cookie-title \{ display: flex/);
  assert.match(css, /\.cookie-banner \.cookie-bite-icon \{[^}]*color: #080808; background: transparent;/);
  assert.match(consent, /export function acceptNecessaryOnly\(\)/);
  assert.match(consent, /export function acceptAnalytics\(\)/);
});

test('header friends and music are highlighted in Ryadom gold against translucent background', async () => {
  const [friendsCss, musicCss, homeCss, header, app] = await Promise.all([
    read('src/styles/friends-entry.css'),
    read('src/music/music.css'),
    read('src/styles/home.css'),
    read('src/components/web/WebHeader.tsx'),
    read('src/App.tsx'),
  ]);
  assert.match(friendsCss, /\.web-friends-trigger \{/);
  assert.match(friendsCss, /backdrop-filter: blur\(9px\)/);
  assert.match(friendsCss, /background: rgba\(7,22,34,\.27\)/);
  assert.match(friendsCss, /\.app-shell:has\(\.city-home\) \.web-friends-trigger > span \{ color: #F3BD5D/);
  assert.match(friendsCss, /\.app-shell:has\(\.city-home\) \.header-friends \{ background: rgba\(7,22,34,\.30\)/);
  assert.match(musicCss, /\.app-shell:has\(\.city-home\) \.web-header \.music-launch/);
  assert.match(musicCss, /color: #F3BD5D/);
  assert.match(homeCss, /\.app-shell:has\(\.city-home\) \.web-header \.music-launch \{ color: #F3BD5D; \}/);
  assert.doesNotMatch(friendsCss, /linear-gradient\(135deg,#ffffff,#dff5ff\)/);
  assert.match(header, /className="web-friends-trigger"/);
  assert.match(app, /className="header-friends"/);
});

test('Vstrechay marker arrives once, then hops only when the home header opts in', async () => {
  const [css, header, app, logo] = await Promise.all([
    read('src/components/brandLogo.css'),
    read('src/components/web/WebHeader.tsx'),
    read('src/App.tsx'),
    read('src/components/BrandLogo.tsx'),
  ]);
  assert.match(css, /animation: vstrechay-pin-arrive 1\.25s/);
  assert.match(css, /animation: vstrechay-pin-hop 12\.5s linear 1\.25s infinite/);
  assert.match(css, /@keyframes vstrechay-pin-hop/);
  assert.match(css, /\.scarivo-logo--animated > \.scarivo-logo__pin > img/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(header, /<BrandLogo animated=\{section === 'home'\} decorative\/>/);
  assert.match(app, /<BrandLogo animated=\{section === 'home'\} decorative\/>/);
  assert.match(logo, /animated = false/);
});
