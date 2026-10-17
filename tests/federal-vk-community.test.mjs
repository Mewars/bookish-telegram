import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('single owner-provided federal VK community is linked only from the footer', async () => {
  const [config, footer, profile, footerCss, accountCss] = await Promise.all([
    readFile('src/config/vkCommunity.ts','utf8'),
    readFile('src/components/FooterBrand.tsx','utf8'),
    readFile('src/pages/ProfilePage.tsx','utf8'),
    readFile('src/styles/chrome.css','utf8'),
    readFile('src/styles/account.css','utf8'),
  ]);
  assert.match(config, /url: 'https:\/\/vk\.ru\/ryadomcity'/);
  assert.match(config, /Федеральное сообщество «РЯДОМ»/);
  assert.doesNotMatch(config, /vk\.ru\/id[0-9]|group_id|access_token|wall\.post/);
  assert.match(footer, /href=\{FEDERAL_VK_COMMUNITY\.url\}/);
  assert.doesNotMatch(footer, /vk\.ru\/mewarspro|По вопросам сотрудничества — VK/);
  assert.match(footer, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(profile, /FEDERAL_VK_COMMUNITY|profile-social-link|Мы во ВКонтакте/);
  assert.equal((footer.match(/className="vk-link"/g)||[]).length,1);
  assert.match(footer, /<h3>Мы в соцсетях:<\/h3>/);
  assert.match(footer, /alt=""\/>ВКонтакте/);
  assert.doesNotMatch(footer, /\{FEDERAL_VK_COMMUNITY\.label\}/);
  assert.match(footerCss, /\.footer-cooperation-links \{[^}]*font-size:14px/);
  assert.match(footerCss, /\.footer-cooperation-links > a, \.footer-cooperation-links > span \{ font:inherit/);
  assert.match(footerCss, /\.footer-social \.vk-link \{[^}]*font-size:14px/);
  assert.doesNotMatch(footerCss, /\.footer-cooperation \.vk-link \+ \.vk-link/);
  assert.doesNotMatch(accountCss, /\.profile-social-link/);
});

test('city groups and posting are not activated by adding a public link', async () => {
  const [app, roadmap] = await Promise.all([
    readFile('src/App.tsx','utf8'),
    readFile('docs/ryadom-marketplace-community-roadmap.md','utf8'),
  ]);
  assert.match(app, /const classifiedsBeta = import\.meta\.env\.VITE_CLASSIFIEDS_ENABLED === 'true' && testBackend/);
  assert.match(roadmap, /Городские группы ещё не предоставлены/);
  assert.match(roadmap, /автоматическая публикация выключена/);
});
