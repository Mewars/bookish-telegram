"""Actual UI modules, synthetic directory accounts/data, local-only browser traffic."""
import base64,re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
ORIGIN='http://127.0.0.1:4178'
SDK=Path('tests/host-catalog-sdk.mjs').read_text()
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width in (360,390,1440):
  context=browser.new_context(viewport={'width':width,'height':900})
  def route(request):
   url=request.request.url
   if url.startswith(ORIGIN+'/host-public/'):
    # These extensions are static native modules on Sprinthost. Bypass Vite's
    # source transform, which rejects their absolute public-directory imports.
    path=Path(urlparse(url).path.lstrip('/'))
    request.fulfill(status=200,content_type='text/css' if path.suffix=='.css' else 'text/javascript',body=path.read_text())
   elif '/wall/supabase-client.js' in url:request.fulfill(status=200,content_type='text/javascript',body=SDK)
   elif '/tests/photo-valid.png' in url:request.fulfill(status=200,content_type='image/png',body=PNG)
   elif '/tests/photo-broken.png' in url:request.fulfill(status=404,body='missing')
   elif url.startswith(ORIGIN+'/'):request.continue_()
   else:request.abort()
  context.route('**/*',route)
  page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  # Missing image, a failed URL and a later valid source all use the real component.
  page.goto(ORIGIN+'/tests/catalog-media-fixture.html')
  expect(page.get_by_role('img',name='Фото скоро появится',exact=True)).to_be_visible()
  page.get_by_role('button',name='Показать фото',exact=True).click()
  expect(page.get_by_role('img',name='Тестовая фотография',exact=True)).to_be_visible()
  page.wait_for_function("document.querySelector('img[alt=\"Тестовая фотография\"]').naturalWidth>0")
  expect(page.get_by_role('img',name='Фото скоро появится',exact=True)).to_have_count(0)
  page.get_by_role('button',name='Недоступное фото',exact=True).click()
  expect(page.get_by_role('img',name='Фото скоро появится',exact=True)).to_be_visible()
  page.get_by_role('button',name='Показать фото',exact=True).click()
  expect(page.get_by_role('img',name='Тестовая фотография',exact=True)).to_be_visible()
  page.get_by_role('button',name='Старая иллюстрация',exact=True).click()
  expect(page.get_by_role('img',name='Фото скоро появится',exact=True)).to_be_visible()
  # The public category module opens a precise city/category/subcategory URL.
  page.goto(ORIGIN+'/#/home')
  page.locator('.city-home').wait_for()
  cookies=page.get_by_role('button',name='Только необходимые',exact=True)
  if cookies.is_visible():cookies.click()
  cover=page.locator('.city-cover');bounds=cover.bounding_box()
  assert abs(bounds['y']+bounds['height']-900)<=3,bounds
  expect(page.get_by_role('link',name='Добавить организацию',exact=True)).to_be_visible()
  assert page.locator('#city-selections').bounding_box()['y']>=897
  assert page.locator('.cover-search').bounding_box()['y']+page.locator('.cover-search').bounding_box()['height']<=bounds['y']+bounds['height']+2
  page.add_script_tag(url=ORIGIN+'/host-public/categories/panel.js',type='module')
  page.get_by_role('button',name='Все категории',exact=True).click()
  page.get_by_role('button',name='Раздел «Где поесть», открыть подразделы',exact=True).click()
  page.get_by_role('button',name=re.compile('^Бургерные и стритфуд')).click()
  page.wait_for_function("decodeURIComponent(location.hash).includes('subcategory=Бургерные')")
  expect(page.get_by_role('group',name='Подкатегории',exact=True).get_by_role('button',name='Бургерные и стритфуд',exact=True)).to_have_attribute('aria-pressed','true')
  expect(page.get_by_role('heading',name='Бургерная «Мясорубка»',exact=True)).to_be_visible()
  expect(page.get_by_role('heading',name='Кафе «Домино»',exact=True)).to_have_count(0)
  # Owner counters and explicit recategorization; no real database is contacted.
  page.goto(ORIGIN+'/tests/host-catalog-fixture.html')
  expect(page.locator('.ryadm-toolbar')).to_contain_text('3 всего · 1 опубликовано · 2 не опубликовано')
  page.get_by_role('button',name=re.compile('^Где поесть')).click()
  burger=page.get_by_role('button',name=re.compile('^Бургерные и стритфуд'))
  expect(burger).to_contain_text('1 всего · 0 опубликовано · 1 не опубликовано')
  burger.click();expect(page.locator('.ryadm-result')).to_have_count(1)
  page.get_by_role('button',name=re.compile('Редактировать')).click()
  page.get_by_label('Подкатегория общепита',exact=True).select_option('restaurant')
  page.get_by_role('button',name='Сохранить',exact=True).click()
  expect(page.get_by_role('dialog',name='Редактирование организации')).to_have_count(0)
  page.get_by_role('button',name='← Разделы',exact=True).click()
  expect(page.get_by_role('button',name=re.compile('^Рестораны'))).to_contain_text('1 всего · 0 опубликовано · 1 не опубликовано')
  # A server-side change triggers fresh counters through the existing event.
  page.evaluate("const rows=JSON.parse(localStorage.getItem('catalog-fixture-data'));rows.find(x=>x.id==='2').status='published';localStorage.setItem('catalog-fixture-data',JSON.stringify(rows));window.dispatchEvent(new Event('ryadom:organizations-changed'))")
  expect(page.locator('.ryadm-toolbar')).to_contain_text('3 всего · 2 опубликовано · 1 не опубликовано')
  page.get_by_label('Город организаций',exact=True).select_option('Город Б')
  expect(page.locator('.ryadm-toolbar')).to_contain_text('1 всего · 1 опубликовано · 0 не опубликовано')
  # The city editor can request only their own city, including after refresh.
  page.evaluate("localStorage.setItem('catalog-actor','editor')")
  page.reload()
  expect(page.get_by_label('Город организаций',exact=True).locator('option')).to_have_count(1)
  expect(page.locator('.ryadm-toolbar')).to_contain_text('3 всего')
  assert page.evaluate("window.catalogRequests.every(call=>call.filters.some(([key,value])=>key==='city'&&value.length===1&&value[0]==='Город А'))")
  assert not errors,errors
  print('PASS',width,'first-screen cover and submission button; real/broken/changed images; shared food route; city/status counters; refresh; owner save; editor scope')
  context.close()
 browser.close()
