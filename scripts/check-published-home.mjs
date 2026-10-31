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
      if (await page.locator('meta[name="ryadom-maintenance"]').count()) {
        assert.equal(response?.status(), 503, 'Maintenance must return a temporary 503');
        await page.getByRole('heading', {name:'Друзья, сайт временно недоступен', exact:true}).waitFor();
        for (const image of await page.locator('main img').all()) {
          await image.evaluate(img => img.decode());
          assert(await image.evaluate(img => img.naturalWidth > 0), 'Maintenance artwork is broken');
        }
        assert.equal(await page.locator('script').count(), 0, 'Maintenance must not start the application');
        assert.equal(await page.locator('form').count(), 0);
        const size = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth, viewport:window.innerWidth}));
        assert(size.scroll <= size.viewport + 1, 'Maintenance overflows on mobile');
        await page.screenshot({path:`${folder}/${scenario.name}-maintenance.png`,fullPage:true,animations:'disabled'});
        const gate = await fetch(`${base}/maintenance/config.json`, {signal:AbortSignal.timeout(12000),cache:'no-store'});
        assert.equal((await gate.json()).enabled, true);
        if (scenario.name === 'desktop-1440') {
          for (const path of ['/wall/','/classifieds/','/stories-preview/','/api/friends.php?health=1','/api/weather.php']) {
            const denied = await fetch(base+path, {signal:AbortSignal.timeout(15000),cache:'no-store'});
            assert.equal(denied.status, 503, `Maintenance bypass: ${path}`);
            assert.match(await denied.text(), /ryadom-maintenance/);
          }
        }
        result.checks.push('Temporary maintenance page, local artwork, no application startup, direct routes closed');
        continue;
      }
      assert(response?.ok(), `Home HTTP status: ${response?.status()}`);
      await page.locator('.city-home').waitFor({ state: 'visible', timeout: 45000 });
      const categoriesLauncher=page.locator('#ryadom-category-trigger');
      await categoriesLauncher.waitFor({state:'visible'});
      assert.equal(await categoriesLauncher.count(),1,'Expected one live category launcher');
      result.checks.push('Live shared category launcher');

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
      const musicGold = page.getByRole('link', { name: 'Радио — официальный сайт Radio Record, откроется в новой вкладке' });
      assert.equal(await musicGold.count(), 1, 'Header radio link is missing');
      assert.equal(await musicGold.getAttribute('href'), 'https://www.radiorecord.ru/');
      assert.equal(await musicGold.getAttribute('target'), '_blank');
      assert.match(await musicGold.getAttribute('rel'), /noopener/);
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

      const compactHome=await page.locator('.home-today').count()>0;
      for (const name of ['Город сегодня','Быстрые действия',compactHome?'Места и организации':'Нужное рядом']) {
        assert.equal(await page.getByRole('heading',{name,exact:true}).count(),1,`Missing city-life section: ${name}`);
      }
      assert.equal(await page.locator('.home-carousel').count(),0,'Legacy directory rails should be absent');
      result.checks.push('Everyday city homepage, compact navigation, no duplicate directory rails');
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
      assert.equal(await footer.locator('.footer-navigation').count(), 0, 'Duplicate footer navigation returned');
      // PRs audit the currently published release. Require new behavior only after this release deploys.
      if (expected) {
        assert.equal(await adminLink.count(), 0, 'Guest must not see the administrative entry');
        for (const name of ['Город сегодня',compactHome?'Места и организации':'Нужное рядом']) {
          assert.equal(await page.getByRole('heading',{name,exact:true}).evaluate(el=>getComputedStyle(el,'::after').display),'none',`Unexpected heading decoration: ${name}`);
        }
        for (const button of await page.locator('.quick-discovery button').all()) {
          assert.equal(await button.evaluate(el=>getComputedStyle(el).backdropFilter),'none','Shortcut retains a blurred pill');
          assert.equal(await button.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Shortcut retains a background pill');
        }
        await footer.scrollIntoViewIfNeeded();
        const top=page.getByRole('button',{name:'Наверх',exact:true});
        await top.waitFor({state:'visible'});
        await page.screenshot({path:`${folder}/${scenario.name}-footer.png`,animations:'disabled'});
        await top.click();await page.waitForFunction(()=>window.scrollY<5);
        assert.equal(await top.isVisible(),false);
        result.checks.push('Guest admin link absent; heading lines and blurred shortcut pills removed; back-to-top works');
      } else {
        await footer.scrollIntoViewIfNeeded();
        await page.screenshot({path:`${folder}/${scenario.name}-footer.png`,animations:'disabled'});
      }

      const coverBounds = await page.locator('.city-cover').boundingBox();
      const coverBottom = await page.locator('.city-cover').evaluate(el => el.getBoundingClientRect().bottom + window.scrollY);
      const viewportHeight=await page.evaluate(()=>window.innerHeight);
      if(compactHome){
        assert(coverBounds&&coverBounds.height<400,'Compact homepage header is too tall');
        assert.equal(await page.getByRole('heading',{name:'Сегодня рядом',exact:true}).count(),1);
        assert.equal(await page.locator('.cover-image').count(),0,'Large city image returned');
        result.checks.push('Compact Today nearby header; catalog and city-life links');
      }else{
        assert(coverBounds && Math.abs(coverBottom-viewportHeight)<5,`City cover must end at the first viewport edge: ${JSON.stringify({coverBounds,coverBottom,viewportHeight})}`);
        result.checks.push('Full first-screen city cover');
      }

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

      await categoriesLauncher.click();
      await page.getByRole('button',{name:'Раздел «Где поесть», открыть подразделы',exact:true}).click();
      await page.getByRole('button',{name:/^Кафе и кофейни/}).click();
      await page.getByRole('heading',{name:'Места',exact:true}).waitFor();
      const cafeFilter=page.getByRole('group',{name:'Подкатегории',exact:true})
        .getByRole('button',{name:'Кафе и кофейни',exact:true});
      assert.equal(await cafeFilter.getAttribute('aria-pressed'),'true');
      assert(page.url().includes('#/places?')&&page.url().includes('subcategory='),'Category selection did not update the public URL');
      assert(await page.locator('main .card').count()>0,'Food category contains no public cards');
      result.checks.push('Shared live directory opens a precise public food subcategory');
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
        // The legacy classifieds hash redirects to the approved host module.
        // Await that redirect instead of racing it against the old beta placeholder.
        await page.goto(`${base}/#/community`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Городская лента готовится' }).waitFor();
        await page.goto(`${base}/#/classifieds`, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(`${base}/classifieds/`);
        await page.getByRole('heading', {name:'Объявления рядом',exact:true}).waitFor();
        await page.getByRole('link',{name:'Войти / зарегистрироваться',exact:true}).waitFor();
        assert.equal(await page.locator('#mod-tab').isVisible(),false,'Guest must not see moderation');
        await page.getByRole('button',{name:'Подать объявление',exact:true}).click();
        await page.getByRole('heading',{name:'Требуется вход в аккаунт',exact:true}).waitFor();
        result.checks.push('Legacy classifieds link opens the approved module; guest submission requires login and moderation is hidden');
      }
      await page.goto(`${base}/#/profile`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /^(Вы не вошли в аккаунт|Войдите в аккаунт)$/ }).waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(await page.getByRole('button', { name: 'Мои заявки' }).count(), 0,
        'Anonymous visitors must not see organization application management in their profile');
      result.checks.push('Guest profile hides organization applications shortcut');
      if(expected){
        await page.goto(`${base}/wall/`,{waitUntil:'domcontentloaded'});
        await page.locator('#tabs:not([inert])').waitFor({state:'visible',timeout:20000});
        assert.equal(await page.locator('#adminTab').isVisible(),false,'Guest wall moderation must be hidden');
        assert(await page.getByRole('textbox',{name:'Написать комментарий',exact:true}).count()>0,'Public posts need a persistent comment composer');
        assert.equal(await page.getByRole('button',{name:/Удалить (свой комментарий|комментарий жителя)/}).count(),0,'Guest cannot delete comments');
        const comments=await page.locator('.comment-preview .comment').count();
        result.checks.push(`Live wall has comment composer, protected controls and ${comments} public comment previews`);
        await page.locator('footer').scrollIntoViewIfNeeded();
        await page.getByRole('button',{name:'Наверх',exact:true}).click();await page.waitForFunction(()=>window.scrollY<5);
        await page.screenshot({path:`${folder}/${scenario.name}-wall.png`,fullPage:true,animations:'disabled'});
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
