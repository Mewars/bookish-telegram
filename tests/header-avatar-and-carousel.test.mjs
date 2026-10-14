import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const file = async path => readFile(path, 'utf8');

test('home arrows sit on both sides of cards and remain visually prominent', async () => {
  const carousel = await file('src/components/HomeCarousel.tsx');
  const styles = await file('src/styles/home.css');
  assert.match(carousel,/className="home-carousel-stage"/);
  assert.match(carousel,/className="home-carousel-arrow home-carousel-arrow--prev"/);
  assert.match(carousel,/className="home-carousel-arrow home-carousel-arrow--next"/);
  assert.match(carousel,/size=\{29\}/);
  assert.match(carousel,/aria-controls=\{id \+ '-cards'\}/);
  assert.match(carousel,/disabled=\{limits\.start\}/);
  assert.match(carousel,/disabled=\{limits\.end\}/);
  assert.match(carousel,/items\.map\(item => <Card key=\{item\.id\}/);
  assert.match(styles,/\.city-home \.home-carousel-stage \.home-carousel-arrow \{/);
  assert.match(styles,/width:64px;height:64px/);
  assert.match(styles,/\.home-carousel-stage \.home-carousel-arrow--prev \{left:-28px;\}/);
  assert.match(styles,/\.home-carousel-stage \.home-carousel-arrow--next \{right:-28px;\}/);
  assert.match(styles,/scroll-snap-type:x mandatory/);
});

test('desktop and compact headers use actual linked account avatar, never a fake placeholder image', async () => {
  const [avatar, web, app, css, profile] = await Promise.all([
    file('src/components/HeaderUserAvatar.tsx'), file('src/components/web/WebHeader.tsx'),
    file('src/App.tsx'), file('src/styles/chrome.css'), file('src/pages/ProfilePage.tsx'),
  ]);
  assert.match(avatar,/useAuth\(\)/);
  assert.match(avatar,/state\.profile\?\.avatar_url/);
  assert.match(avatar,/uri\.protocol === 'https:'/);
  assert.match(avatar,/!uri\.username && !uri\.password/);
  assert.match(avatar,/referrerPolicy="no-referrer"/);
  assert.match(avatar,/onError=\{\(\) => setFailed\(avatar\)\}/);
  assert.match(avatar,/<Icon name="profile" size=\{20\}\/>/);
  assert.match(web,/<HeaderUserAvatar\/>/);
  assert.match(app,/className="web-profile-button header-profile-button"/);
  assert.match(app,/<HeaderUserAvatar\/>/);
  assert.match(css,/\.web-profile-button \.header-user-avatar/);
  assert.match(profile,/const avatar = profile\?\.avatar_url/);
});
