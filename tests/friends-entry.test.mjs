import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = path => readFile(path, 'utf8');

test('friends mascot replaces both header favorites shortcuts but keeps saved places in profile', async () => {
  const [web, app, profile, mascot, css] = await Promise.all([
    read('src/components/web/WebHeader.tsx'),
    read('src/App.tsx'),
    read('src/pages/ProfilePage.tsx'),
    read('src/friends/FriendsMascot.tsx'),
    read('src/styles/friends-entry.css'),
  ]);
  assert.match(web, /className="web-friends-trigger"/);
  assert.match(web, /friendsEnabled && <button/);
  assert.match(web, /<FriendsMascot size=\{33\}\/>/);
  assert.doesNotMatch(web, /navigate\('favorites'\)/);
  assert.doesNotMatch(web, /Избранное/);
  assert.match(app, /className="header-friends"/);
  assert.match(app, /openFriendsIntro/);
  assert.doesNotMatch(app, /className="header-heart"/);
  assert.match(profile, /<strong>Избранное<\/strong>/);
  assert.match(profile, /onClick=\{openFavorites\}/);
  assert.match(mascot, /viewBox="0 0 100 100"/);
  assert.match(mascot, /aria-hidden="true"/);
  assert.match(css, /\.web-friends-trigger/);
  assert.match(css, /\.header-friends/);
  assert.match(css, /@media \(max-width:359px\)/);
});

test('explainer dialog opens only from the friends entry, preserves consent and navigation', async () => {
  const [app, modal, styles, importedStyles] = await Promise.all([
    read('src/App.tsx'),
    read('src/friends/FriendsIntroDialog.tsx'),
    read('src/styles/friends-entry.css'),
    read('src/styles.css'),
  ]);
  assert.match(app, /friendsEnabled \? openFriendsIntro : undefined/);
  assert.match(app, /friendsIntroOpen && <FriendsIntroDialog/);
  assert.match(app, /navigate\('friends'\)/);
  assert.match(modal, /<dialog ref=\{ref\}/);
  assert.match(modal, /dialog\?\.showModal\(\)/);
  assert.match(modal, /onCancel=\{event => \{ event\.preventDefault\(\); onDismiss\(\); \}\}/);
  assert.match(modal, /previousFocus\.focus\(\{ preventScroll: true \}\)/);
  assert.match(modal, /друзей.*по личному коду/);
  assert.match(modal, /по умолчанию скрыто/);
  assert.match(modal, /на один час/);
  assert.match(modal, /Открыть друзей/);
  assert.match(modal, /Понятно/);
  assert.doesNotMatch(modal, /getCurrentPosition|watchPosition|geolocation/);
  assert.match(styles, /\.friends-intro-dialog::backdrop/);
  assert.match(importedStyles, /friends-entry\.css/);
});
