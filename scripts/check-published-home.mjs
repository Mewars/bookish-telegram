/* global process, fetch, AbortSignal, console, document, window, getComputedStyle, navigator */
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
    await context.addInitScript(()=>{
      window.__ryadomGpsCalls=0;
      const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition=(...args)=>{window.__ryadomGpsCalls++;return original(...args);};
    });
    const page = await context.newPage();
    const result = { viewport: scenario.name, checks: [], errors: [] };
    try {
      const response = await page.goto(`${base}/#/home`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      assert(response?.ok(), `Home HTTP status: ${response?.status()}`);
      await page.locator('.city-home').waitFor({ state: 'visible', timeout: 45000 });
      assert.equal((await page.locator('.quick-discovery button').allTextContents()).map(x => x.trim()).join('|'), 'Сегодня|Поесть|Культура|Магазины|Услуги');
      result.checks.push('All five quick categories');

      const cookies = page.getByRole('button', { name: 'Только необходимые' });
      if (await cookies.isVisible().catch(() => false)) {
        const cookieGlyph = page.locator('.cookie-banner .cookie-title .cookie-bite-icon');
        assert.equal(await cookieGlyph.count(), 1, 'Black bitten cookie mark must appear beside consent title');
        assert.equal(await cookieGlyph.evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)', 'Cookie glyph must have a transparent background');
        await cookies.click();
      }
      const friendsGold = page.getByRole('button', { name: 'Друзья рядом — узнать о разделе' });
      assert.equal(await friendsGold.count(), 1, 'Friends header shortcut is missing');
      const friendsSkin = await friendsGold.evaluate(el => ({
        labelColor: getComputedStyle(el.querySelector('span') ?? el).color,
        background: getComputedStyle(el).backgroundColor,
      }));
      if (scenario.name === 'desktop-1440') {
        assert.equal(friendsSkin.labelColor, 'rgb(243, 189, 93)', 'Friends label must match Ryadom gold');
      }
      assert.match(friendsSkin.background, /^rgba\(/, 'Friends background must be translucent, not a solid white pill');
      const musicGold = page.getByRole('button', { name: 'Открыть Музыку рядом' });
      assert.equal(await musicGold.count(), 1, 'Header music shortcut is missing');
      assert.equal(await musicGold.evaluate(el => getComputedStyle(el).color), 'rgb(243, 189, 93)', 'Music nearby must use Ryadom gold');
      result.checks.push('Transparent bitten-cookie icon, translucent friends shortcut, Ryadom-gold header accents');

      const weatherTrigger = page.locator('.header-city-weather .city-weather-trigger');
      const weather = page.getByRole('dialog', { name: 'Погода — Енисейск' });
      assert.equal(await weather.isVisible(), false, 'Weather should be collapsed into the city icon');
      await weatherTrigger.click();
      await weather.locator('.weather-current strong').waitFor({ state: 'visible', timeout: 20000 });
      assert.equal(await weather.getByRole('link', { name: 'MET Norway' }).count(), 1);
      assert(await weather.locator('.weather-hours li').count() >= 2, 'City forecast has no hourly cards');
      await weather.screenshot({ path: `${folder}/${scenario.name}-weather.png`, animations: 'disabled' });
      await weather.getByRole('button', { name: 'Закрыть погоду' }).click();
      assert.equal(await weather.isVisible(), false);
      result.checks.push('Compact city weather icon opens current and hourly forecast');

      const titles = await page.locator('#city-selections .section-heading h2').allTextContents();
      for (const name of ['Выбор «Рядом»','Афиша города','Где поесть','Что посмотреть','За покупками','Услуги','Партнёры «Рядом»']) {
        assert(titles.includes(name), `Missing section: ${name}`);
      }
      result.checks.push('All agreed editorial sections');
      assert.equal(await page.locator('.city-selections-backdrop').count(), 0, 'Repeated photo backdrop should be off');
      result.checks.push('Single photo hero, solid dark lower background');
      const a11y = page.getByRole('button', {name:'Версия для слабовидящих',exact:true});
      await a11y.waitFor({state:'visible',timeout:10000});
      assert.equal(await page.locator('.accessibility-button--fixed').isVisible(),false,
        'The existing host shell uses the footer launcher');
      await a11y.click();
      const a11yDialog=page.getByRole('dialog',{name:'Настройки доступности',exact:true});
      await a11yDialog.waitFor({state:'visible'});
      await a11yDialog.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
      result.checks.push('Existing footer accessibility launcher opens the settings dialog');

      // Check the actual deployed footer, not just the source or release hash.
      const footer = page.locator('.web-footer');
      const adminLink = footer.locator('.footer-admin-link');
      await adminLink.waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await adminLink.count(), 1, 'Expected exactly one footer admin entry');
      assert.equal(await footer.locator('.footer-legal').getByText('Административная панель').count(), 0,
        'Old oversized admin entry still appears beneath legal links');
      assert.equal(await footer.locator('.footer-navigation').count(), 0, 'Duplicate footer navigation returned');
      const adminPlacement = await adminLink.evaluate(element => {
        const parent = element.closest('.web-footer-note');
        const bounds = element.getBoundingClientRect();
        const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
        const noteBounds = parent?.getBoundingClientRect();
        return {
          inUtilityRow: !!parent,
          fontSize,
          insideUtilityRow: !!noteBounds && bounds.top >= noteBounds.top - 1 && bounds.bottom <= noteBounds.bottom + 1,
          rightAligned: !!noteBounds && noteBounds.right - bounds.right < 30,
          noWrap: getComputedStyle(element).whiteSpace === 'nowrap',
        };
      });
      assert(adminPlacement.inUtilityRow && adminPlacement.insideUtilityRow,
        `Admin entry is outside footer utility row: ${JSON.stringify(adminPlacement)}`);
      assert(adminPlacement.fontSize <= 12, 'Admin entry is too large');
      assert(adminPlacement.noWrap, 'Admin entry wraps into multiple lines');
      if (scenario.name === 'desktop-1440') assert(adminPlacement.rightAligned, 'Desktop admin entry is not right-aligned');
      result.checks.push('Admin entry compact and in footer bottom row; old link and duplicate navigation absent');
      await adminLink.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${folder}/${scenario.name}-footer.png`, animations: 'disabled' });

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
      assert.equal(await page.getByRole('button', { name: 'Друзья рядом · Открыть карту' }).count(), 0, 'Duplicate friends CTA must not appear beneath the homepage hero');
      const friendsShortcut = page.getByRole('button', { name: 'Друзья рядом — узнать о разделе' });
      assert.equal(await friendsShortcut.count(), 1, 'Friends mascot must replace favorites in the header');
      assert.equal(await page.locator('.web-favorites, .header-heart').count(), 0, 'Old header favorites shortcut is still visible');
      await friendsShortcut.click();
      const friendIntro = page.getByRole('dialog', { name: 'Друзья рядом' });
      await friendIntro.waitFor({ state: 'visible' });
      assert.equal(await friendIntro.getByRole('button', { name: 'Открыть друзей' }).count(), 1);
      assert.equal(await page.evaluate(() => window.__ryadomGpsCalls), 0, 'Explainer must not request GPS');
      await friendIntro.screenshot({ path: `${folder}/${scenario.name}-friends-intro.png`, animations: 'disabled' });
      await friendIntro.getByRole('button', { name: 'Понятно' }).click();
      await friendIntro.waitFor({ state: 'hidden' });
      await friendsShortcut.click();
      await friendIntro.getByRole('button', { name: 'Открыть друзей' }).click();
      await page.waitForURL('**/#/friends');
      result.checks.push('Mascot opens reusable accessible explainer; opening friends needs explicit click and no GPS');
      await page.getByRole('heading', {name:'Друзья рядом',exact:true}).waitFor();
      await page.getByRole('button',{name:'Войти в аккаунт',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>window.__ryadomGpsCalls),0,'Guest friends page must not request GPS');
      await page.screenshot({path:`${folder}/${scenario.name}-friends.png`,animations:'disabled'});
      result.checks.push('Live friends opens through existing account login without requesting GPS');
      if (scenario.name === 'desktop-1440') {
        const health=await fetch(`${base}/api/friends.php?health=1`,{signal:AbortSignal.timeout(15000)});
        assert.equal(health.status,200,'Live private friends storage unavailable');
        assert.deepEqual(await health.json(),{ready:true,backend:'host'});
        const denied=await fetch(`${base}/api/friends.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'nearby_state'}),signal:AbortSignal.timeout(15000)});
        assert.equal(denied.status,401,'Anonymous friends API access must be rejected');
        assert.match(denied.headers.get('cache-control')??'',/no-store/);
        const forged=await fetch(`${base}/api/friends.php`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${'x'.repeat(64)}`},body:JSON.stringify({name:'nearby_state'}),signal:AbortSignal.timeout(15000)});
        assert.equal(forged.status,401,'Server must verify and reject a forged identity through Auth');
        result.checks.push('Live host storage ready; anonymous private API access denied');
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
      await page.goto(`${base}/#/profile`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Вы не вошли в аккаунт' }).waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(await page.getByRole('button', { name: 'Мои заявки' }).count(), 0,
        'Anonymous visitors must not see organization application management in their profile');
      result.checks.push('Guest profile hides organization applications shortcut');
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
