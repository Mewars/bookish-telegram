/* global process, fetch, AbortSignal, console, document, window */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, devices } from 'playwright';

const base = 'https://ryadomcity.ru';
const expected = process.env.RYADOM_EXPECTED_SHA;
const folder = 'qa-screenshots';
await mkdir(folder, { recursive: true });

if (expected) {
  let actual = '';
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${base}/version.json?qa=${Date.now()}`, { signal: AbortSignal.timeout(12000), headers: { 'cache-control': 'no-cache' } });
      if (res.ok) actual = String((await res.json()).version || '');
    } catch (error) { console.warn('Release check:', String(error)); }
    if (actual === expected) break;
    if (i < 19) await delay(10000);
  }
  assert.equal(actual, expected, 'Published version does not match the deployed commit');
}

const browser = await chromium.launch({ headless: true });
const results = [];
let failed = false;
try {
  for (const scenario of [
    { name: 'desktop-1440', options: { viewport: { width: 1440, height: 900 } } },
    { name: 'iphone-13', options: devices['iPhone 13'] },
    { name: 'android-360', options: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  ]) {
    const context = await browser.newContext({ ...scenario.options, locale: 'ru-RU', timezoneId: 'Asia/Krasnoyarsk' });
    const page = await context.newPage();
    const result = { viewport: scenario.name, checks: [], errors: [] };
    try {
      const response = await page.goto(`${base}/#/home`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      assert(response?.ok(), `Home HTTP status: ${response?.status()}`);
      await page.locator('.city-home').waitFor({ state: 'visible', timeout: 45000 });
      assert.equal((await page.locator('.quick-discovery button').allTextContents()).map(x => x.trim()).join('|'), 'Сегодня|Поесть|Культура|Магазины|Услуги');
      result.checks.push('All five quick categories');

      const cookies = page.getByRole('button', { name: 'Только необходимые' });
      if (await cookies.isVisible().catch(() => false)) await cookies.click();

      const titles = await page.locator('#city-selections .section-heading h2').allTextContents();
      for (const name of ['Выбор «Рядом»','Афиша города','Где поесть','Что посмотреть','За покупками','Услуги','Партнёры «Рядом»']) {
        assert(titles.includes(name), `Missing section: ${name}`);
      }
      result.checks.push('All agreed editorial sections');

      const track = page.locator('.home-carousel-track').first();
      await track.scrollIntoViewIfNeeded();
      const start = await track.evaluate(el => ({ x: el.scrollLeft, overflow: el.scrollWidth > el.clientWidth + 10 }));
      assert(start.overflow, 'Carousel contains no offscreen cards');
      if (scenario.name === 'desktop-1440') {
        await page.locator('.home-carousel').first().locator('.home-carousel-arrow--next').click();
        await page.waitForTimeout(600);
      } else {
        const bounds = await track.boundingBox();
        assert(bounds, 'Carousel has no dimensions');
        const x = Math.round(bounds.x + Math.min(bounds.width - 85, 250));
        const y = Math.round(bounds.y + Math.min(170, bounds.height * 0.72));
        const hit = await page.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y);
          return { tag: element?.tagName ?? null, onCarousel: !!element?.closest('.home-carousel-track') };
        }, { x, y });
        result.checks.push(`Touch hit target: ${JSON.stringify(hit)}`);
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.synthesizeScrollGesture', {
          x, y, xDistance: 230, yDistance: 0, gestureSourceType: 'touch', speed: 500, preventFling: true,
        });
        await page.waitForTimeout(750);
      }
      const end = await track.evaluate(el => el.scrollLeft);
      assert(end > start.x + 10, `Carousel did not move: ${start.x} -> ${end}`);
      result.checks.push('Carousel arrow or genuine mobile touch swipe');

      const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      assert(size.scroll <= size.viewport + 3, `Horizontal page overflow: ${JSON.stringify(size)}`);
      result.checks.push('No horizontal page overflow');
      const hero = page.locator('.cover-image img').first();
      if (await hero.count()) {
        await hero.evaluate(img => img.decode());
        assert(await hero.evaluate(img => img.naturalWidth > 0), 'Cover image is broken');
        result.checks.push('Cover image loads');
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(100);
      await page.screenshot({ path: `${folder}/${scenario.name}-home.png`, fullPage: true, animations: 'disabled' });

      await page.locator('.quick-discovery button').filter({ hasText: 'Поесть' }).click();
      await page.locator('#city-selections .section-heading h2').getByText('Поесть', { exact: true }).waitFor();
      result.checks.push('Food shortcut opens filtered results');
      await page.screenshot({ path: `${folder}/${scenario.name}-food.png`, fullPage: true, animations: 'disabled' });
    } catch (error) {
      failed = true;
      result.errors.push(error.stack || String(error));
      await page.screenshot({ path: `${folder}/${scenario.name}-FAILED.png`, fullPage: true }).catch(() => {});
    } finally {
      console.log(JSON.stringify(result));
      results.push(result);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(`${folder}/report.json`, JSON.stringify({ expected, results }, null, 2));
}
if (failed) process.exitCode = 1;
