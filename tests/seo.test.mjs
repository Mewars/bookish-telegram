import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import { HOME_METADATA, HOME_URL, pageMetadata } from '../src/seo/metadata.ts';

test('static homepage and runtime defaults agree, public URLs use the canonical domain', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(`<title>${HOME_METADATA.title}</title>`));
  assert.equal(HOME_METADATA.title,'Рядом');
  assert.equal(pageMetadata('home',undefined,undefined,'Лесосибирск').title,'Рядом');
  assert.match(html, /property="og:title" content="Рядом"/);
  assert.match(html, /name="twitter:title" content="Рядом"/);
  assert.ok(html.includes(`name="description" content="${HOME_METADATA.description}"`));
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
  assert.ok(html.includes(`rel="canonical" href="${HOME_URL}"`));
  const properties = [...html.matchAll(/<meta (?:name|property)="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(properties).size, properties.length);
  for (const match of html.matchAll(/(?:href|content)="(https?:[^"]+)"/g)) {
    assert.equal(new URL(match[1]).origin, 'https://ryadomcity.ru');
  }
  const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(json['@type'], 'WebSite');
  assert.equal(json.url, HOME_URL);
  assert.equal(json.inLanguage, 'ru-RU');
  assert.equal(html.includes('LocalBusiness'), false);
  assert.equal(html.includes('aggregateRating'), false);
});

test('public sections are distinct; private screens never inherit a place or homepage canonical', () => {
  const sections = ['places', 'events', 'services'];
  assert.equal(new Set(sections.map(section => pageMetadata(section).title)).size, sections.length);
  for (const section of [...sections, 'profile', 'login', 'favorites', 'import', 'privacy', 'consent']) {
    assert.equal(pageMetadata(section).canonical, undefined);
    assert.ok(pageMetadata(section).title.includes('Рядом'));
  }
  assert.deepEqual(pageMetadata('home'), HOME_METADATA);
});

test('real place uses supplied public copy; missing/demo cards do not invent facts or URLs', () => {
  const place = { id: 'real', kind: 'places', real: true, title: 'Музей', city: 'Енисейск', description: 'Описание музея.' };
  assert.deepEqual(pageMetadata('places', 'real', place), { title: 'Музей — Енисейск | Рядом', description: place.description });
  assert.deepEqual(pageMetadata('favorites', 'real', place), pageMetadata('places', 'real', place));
  assert.equal(pageMetadata('places', 'missing').title, 'Карточка не найдена — Рядом');
  for (const kind of ['events', 'services', 'places']) {
    const demo = { ...place, kind, real: false, title: 'Invented', description: 'Invented facts' };
    const metadata = pageMetadata(kind, 'demo', demo);
    assert.equal(metadata.title.includes('Invented'), false);
    assert.equal(metadata.description.includes('Invented'), false);
    assert.equal(metadata.canonical, undefined);
  }
});

test('sitemap contains only the real root URL; robots leaves assets crawlable', async () => {
  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), [HOME_URL]);
  assert.equal(sitemap.includes('lastmod'), false);
  assert.equal(sitemap.includes('#'), false);
  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert.ok(robots.includes('Sitemap: https://ryadomcity.ru/sitemap.xml'));
  assert.equal(robots.includes('Disallow:'), false);
});
