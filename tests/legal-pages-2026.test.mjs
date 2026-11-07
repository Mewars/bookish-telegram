import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('privacy, publication, advertising and payment information have routes and footer links', async () => {
  const [app, route, types, links, meta] = await Promise.all([
    read('src/App.tsx'), read('src/hooks/useRoute.ts'), read('src/types/index.ts'),
    read('src/components/legal/LegalLinks.tsx'), read('src/seo/metadata.ts'),
  ]);
  for (const name of ['privacy', 'cookies', 'terms', 'contacts', 'consent', 'publication-consent', 'ads-consent', 'paid-services']) {
    assert.ok(types.includes("'"+name+"'"), 'Section type: '+name);
    assert.ok(route.includes("'"+name+"'"), 'allow route: '+name);
    assert.ok(links.includes('href="#/'+name+'"'), 'legal footer link: '+name);
    assert.ok(meta.includes(name+':'), 'metadata: '+name);
    assert.ok(app.includes("'"+name+"'"), 'render route: '+name);
  }
});

test('interim publications do not claim a registered NPD spouse or active payments', async () => {
  const [privacy, contacts, payments, ads, publication] = await Promise.all([
    read('src/pages/PrivacyPolicyPage.tsx'), read('src/pages/OperatorContactsPage.tsx'),
    read('src/pages/PaidServicesPage.tsx'), read('src/pages/AdvertisingConsentPage.tsx'),
    read('src/pages/PublicationConsentPage.tsx'),
  ]);
  assert.match(privacy, /Евсеев Александр Романович/);
  assert.match(privacy, /eu-west-1/);
  assert.match(contacts, /Евсеев Александр Романович/);
  assert.match(payments, /не подключены/);
  assert.match(ads, /не введён/);
  assert.match(publication, /не являются предоставлением согласия/);
});

test('cookie opt-out is real and Yandex Webvisor disabled', async () => {
  const [banner, choice, metrika] = await Promise.all([
    read('src/privacy/CookieBanner.tsx'), read('src/privacy/cookieConsent.ts'),
    read('src/analytics/yandexMetrika.ts'),
  ]);
  assert.match(banner, /Отказаться от аналитики/);
  assert.match(banner, /onClick=\{acceptNecessaryOnly\}/);
  assert.match(choice, /export function acceptNecessaryOnly\(\) \{ save\('necessary'\)/);
  assert.match(metrika, /webvisor: false/);
});

test('standalone wall and classified modules link to policy and separate consent pages', async () => {
  for(const path of ['host-public/wall/index.html','host-public/classifieds/index.html']) {
    const html = await read(path);
    assert.match(html, /\/#\/privacy/);
    assert.match(html, /\/#\/terms/);
    assert.match(html, /\/#\/publication-consent/);
    assert.match(html, /\/#\/cookies/);
  }
});
