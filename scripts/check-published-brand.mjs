/* global process, fetch, AbortSignal, console, document, getComputedStyle, location, innerWidth, Buffer */
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
// Inspect standalone host pages too; they do not use the React entrypoint.
for (const path of ['/wall/', '/classifieds/', '/notifications/', '/donate/']) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  assert(response.ok(), `${path}: public page must load`);
  const html = await response.text();
  assert.match(html, /<title>[^<]*Встречай/, `${path}: title must use the current brand`);
  assert.doesNotMatch(html, /Scarivo|РЯДОМ|Рядом|ryadom-logo-transparent/);
  assert.match(html, /scarivo-winter\.svg\?v=vstrechay1/, `${path}: static logo must use the new vector`);
}
for (const path of ['/app.webmanifest', '/notifications/manifest.webmanifest']) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  assert(response.ok(), `${path}: manifest must exist`);
  const manifest = await response.json();
  assert.equal(manifest.short_name, 'Встречай');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons) {
    const image = await fetch(base + icon.src, { signal: AbortSignal.timeout(15000) });
    assert(image.ok(), `Icon must load: ${icon.src}`);
    const bytes = Buffer.from(await image.arrayBuffer());
    assert.equal(bytes.subarray(1,4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), Number(icon.sizes.split('x')[0]));
  }
}
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 768, 390, 360, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 900 });
    await page.goto(`${base}/#/home`, { waitUntil: 'domcontentloaded' });
    const logo = page.locator('.web-header .scarivo-logo,.app-header .scarivo-logo').first();
    await logo.waitFor();
    await page.waitForFunction(() => document.title === 'Встречай — городская платформа');
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
      return { start: sample(0), arc: sample(150), rest: sample(650), squash: sample(737.5), bounce: sample(875), end: sample(1250), stopped: sample(9000), iterations: animation.effect.getTiming().iterations, duration: animation.effect.getTiming().duration };
    });
    assert.equal(measured.duration, 1250, 'Arrival must finish in 1.25s');
    assert.equal(measured.iterations, 1, 'Arrival must never loop');
    assert(measured.start.pin[0] < measured.rest.pin[0], 'Marker must arrive from the left');
    assert(measured.arc.pin[1] < measured.rest.pin[1], 'Marker must follow an arc above its final position');
    assert(measured.bounce.pin[1] < measured.rest.pin[1], 'Landing must rebound');
    assert.deepEqual(measured.end.pin, measured.stopped.pin, 'Marker must stay still after arrival');
    for (const phase of ['start', 'arc', 'squash', 'bounce', 'end', 'stopped']) {
      assert.deepEqual(measured[phase].letters, measured.rest.letters, 'Letters must remain still');
      assert.deepEqual(measured[phase].header, measured.rest.header, 'Header must not resize');
    }
    assert(measured.squash.pin[3] < measured.rest.pin[3], 'Landing must gently squash');
    assert.equal(await logo.locator('.scarivo-logo__pin > .scarivo-logo__hat').count(), 1, 'Hat must travel in the marker wrapper');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Header must fit narrow screens');
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
    console.log(`${width}px: Встречай home-only 1.25s arrival, rebound, stop, squash, stable header, static inner pages/footer, reduced motion: PASS`);
    await page.close();
  }
} finally {
  await writeFile(`${folder}/brand-report.json`, JSON.stringify({ expected, results }, null, 2));
  await browser.close();
}
