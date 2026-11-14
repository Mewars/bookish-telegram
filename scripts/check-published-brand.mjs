/* global process, fetch, AbortSignal, console, getComputedStyle, location */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SCARIVO_QA_URL || 'https://ryadomcity.ru';
const expected = process.env.RYADOM_EXPECTED_SHA;
const folder = 'qa-screenshots';
await mkdir(folder, { recursive: true });
if (expected) {
  const response = await fetch(`${base}/version.json?brand=${Date.now()}`, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  assert.equal((await response.json()).version, expected, 'Brand QA must inspect the deployed commit');
}
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390, 360]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 900 });
    await page.goto(`${base}/#/home`, { waitUntil: 'domcontentloaded' });
    const logo = page.locator('.web-header .scarivo-logo,.app-header .scarivo-logo').first();
    await logo.waitFor();
    await logo.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    const measured = await logo.evaluate(el => {
      const pin = el.querySelector('.scarivo-logo__pin');
      const animation = pin.getAnimations()[0];
      if (!animation) throw Error('Home header logo must animate');
      animation.pause();
      const rect = node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
      const sample = time => {
        animation.currentTime = time;
        return { pin: rect(pin), letters: rect(el.firstElementChild), header: rect(el.closest('header')) };
      };
      return { rest: sample(0), pause: sample(3400), apex: sample(3828), squash: sample(4268) };
    });
    assert(Math.abs(measured.apex.pin[1] - measured.rest.pin[1] + 7) < .1, 'Jump must be 7 CSS px');
    assert.deepEqual(measured.pause.pin, measured.rest.pin, 'Pause must last at least 3.4 seconds');
    for (const phase of ['pause', 'apex', 'squash']) {
      assert.deepEqual(measured[phase].letters, measured.rest.letters, 'Letters must remain still');
      assert.deepEqual(measured[phase].header, measured.rest.header, 'Header must not resize');
    }
    assert(measured.squash.pin[3] < measured.rest.pin[3], 'Landing must gently squash');
    assert.equal(await page.locator('.scarivo-logo--animated').count(), 1);
    assert.equal(await page.locator('.web-footer .scarivo-logo--animated').count(), 0);
    await page.screenshot({ path: `${folder}/brand-${width}-home.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await logo.locator('.scarivo-logo__pin').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const route of ['places', 'profile', 'login', 'admin']) {
      await page.evaluate(route => { location.hash = `/${route}`; }, route);
      await page.locator(`.app-shell[data-section="${route}"]`).waitFor();
      assert.equal(await page.locator('.scarivo-logo--animated').count(), 0, `${route}: all logos must be static`);
      assert(await page.locator('.scarivo-logo__pin').evaluateAll(els => els.every(el => getComputedStyle(el).animationName === 'none')));
    }
    await page.evaluate(() => { location.hash = '/home'; });
    await page.locator('header .scarivo-logo--animated').waitFor();
    assert.equal(await page.locator('.scarivo-logo--animated').count(), 1);
    results.push({ width, passed: true, measured });
    console.log(`${width}px: Scarivo home-only 7px jump, pause, squash, stable header, static inner pages/footer, reduced motion: PASS`);
    await page.close();
  }
} finally {
  await writeFile(`${folder}/brand-report.json`, JSON.stringify({ expected, results }, null, 2));
  await browser.close();
}
