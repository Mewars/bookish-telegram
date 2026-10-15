/* global process, fetch, AbortSignal, console, document, window, getComputedStyle, innerWidth, innerHeight */
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
      assert.equal(await page.locator('.city-selections-backdrop').count(), 0, 'Repeated photo backdrop should be off');
      result.checks.push('Single photo hero, solid dark lower background');
      const a11y = page.locator('.accessibility-button--fixed');
      await a11y.waitFor({ state: 'visible', timeout: 10000 });
      const placement = await a11y.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return { position: getComputedStyle(element).position, right: innerWidth - bounds.right, bottom: innerHeight - bounds.bottom };
      });
      assert.equal(placement.position, 'fixed');
      assert(placement.right >= 0 && placement.right < 50, 'Accessibility button is not docked to the right');
      assert(placement.bottom >= 0 && placement.bottom < (scenario.name === 'desktop-1440' ? 55 : 180),
        'Accessibility button is not docked near the bottom');
      result.checks.push('Accessibility launcher fixed near lower-right corner');

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
        result.checks.push(`Wheel hit target: ${JSON.stringify(hit)}`);
        // Headless Chromium's CDP touch synthesis does not scroll even a plain
        // standalone overflow-x:auto test element. Verify horizontal scrolling
        // in a mobile viewport without falsely claiming a real finger gesture.
        await page.mouse.move(x, y);
        await page.mouse.wheel(230, 0);
        await page.waitForTimeout(750);
      }
      const end = await track.evaluate(el => el.scrollLeft);
      assert(end > start.x + 10, `Carousel did not move: ${start.x} -> ${end}`);
      result.checks.push(scenario.name === 'desktop-1440' ? 'Desktop carousel arrow' : 'Mobile-viewport horizontal scrolling (not a physical touch test)');

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
      if (scenario.name === 'desktop-1440') {
        await page.goto(`${base}/#/contacts`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Контакты владельца' }).waitFor();
        const vk = page.locator('.legal-document a[href="https://vk.ru/mewarspro"]');
        assert(await vk.isVisible(), 'Owner VK contact link missing');
        result.checks.push('Owner contacts page and VK link');
        await page.screenshot({ path: `${folder}/${scenario.name}-contacts.png`, fullPage: true, animations: 'disabled' });
        // Unreviewed community and classified beta must never open against
        // production Supabase, even if someone guesses the hash URL.
        await page.goto(`${base}/#/community`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Городская лента готовится' }).waitFor();
        await page.goto(`${base}/#/classifieds`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Объявления готовятся' }).waitFor();
        result.checks.push('Classified and community betas remain disabled in production');
      }
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
