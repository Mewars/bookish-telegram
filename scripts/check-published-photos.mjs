/* global console, process, location */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SCARIVO_QA_URL || 'https://ryadomcity.ru';
const folder = 'qa-screenshots';
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 900 });
    await page.goto(`${base}/#/places?city=${encodeURIComponent('Енисейск')}`, { waitUntil: 'domcontentloaded' });
    const listedPhoto = page.locator('.card-image>img[src*="/storage/v1/object/public/ryadom-places/"]').first();
    await listedPhoto.waitFor();
    await listedPhoto.evaluate(img => img.decode());
    for (const [id, title] of [['place-borodkin-house', 'Гостевой дом купца Бородкина / Дом Бородкина'], ['place-cafe-domino', 'Кафе «Домино»']]) {
      await page.evaluate(id => { location.hash = `/places/${id}?city=${encodeURIComponent('Енисейск')}`; }, id);
      await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
      const photo = page.locator('.guide-detail .place-media-frame>img').first();
      await photo.waitFor();
      const src = await photo.getAttribute('src');
      assert(src.includes('/storage/v1/object/public/ryadom-places/'), 'Detail must keep its original stored photo');
      await photo.evaluate(img => img.decode());
      assert(await photo.evaluate(img => img.naturalWidth > 0), 'Stored photo must load');
      await page.screenshot({ path: `${folder}/photo-${width}-${id}.png` });
      results.push({ width, id, src, passed: true });
    }
    console.log(`${width}px: existing photos load in the catalogue and both detail cards: PASS`);
    await page.close();
  }
} finally {
  await writeFile(`${folder}/photos-report.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
