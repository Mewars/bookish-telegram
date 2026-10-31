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
  admin_fixture=False
  def route(request):
   url=request.request.url
   if any(url.startswith(ORIGIN+prefix) for prefix in ['/host-public/admin/','/host-public/categories/']):
    # Native host admin/category modules need their raw source. React imports
    # from host-public/wall (including CSS-as-JS in dev) must go through Vite.
    path=Path(urlparse(url).path.lstrip('/'))
    request.fulfill(status=200,content_type='text/css' if path.suffix=='.css' else 'text/javascript',body=path.read_text())
   elif admin_fixture and urlparse(url).path=='/src/lib/supabase.ts':request.fulfill(status=200,content_type='text/javascript',body="import {c} from '/tests/host-catalog-sdk.mjs';export const supabase=c();")
   elif '/wall/supabase-client.js' in url:request.fulfill(status=200,content_type='text/javascript',body=SDK)
   elif '/tests/photo-valid.png' in url:request.fulfill(status=200,content_type='image/png',body=PNG)
   elif '/tests/photo-broken.png' in url:request.fulfill(status=404,body='missing')
   elif url.startswith(ORIGIN+'/'):request.continue_()
   else:request.abort()
  context.route('**/*',route)
  page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('console',lambda message: print('BROWSER ERROR',message.text,flush=True) if message.type=='error' else None)
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
  try: page.locator('.city-home').wait_for()
  except Exception:
   print('STARTUP ERRORS',errors,flush=True)
   print('STARTUP BODY',page.locator('body').inner_text()[:3000],flush=True)
   raise
  cookies=page.get_by_role('button',name='Только необходимые',exact=True)
  if cookies.is_visible():cookies.click()
  cover=page.locator('.city-cover');bounds=cover.bounding_box()
  assert abs(bounds['y']+bounds['height']-900)<=3,bounds
  expect(page.get_by_role('link',name='Добавить бесплатно',exact=True)).to_have_count(0)
  expect(page.get_by_role('link',name='Добавить организацию Рассказать о своём деле',exact=True)).to_be_visible()
  expect(page.locator('.life-business-actions').get_by_role('link',name='Бизнесу',exact=True)).to_have_attribute('href',re.compile(r'^#/business\?city='))
  assert page.locator('#city-selections').bounding_box()['y']>=897
  assert page.locator('.cover-search').bounding_box()['y']+page.locator('.cover-search').bounding_box()['height']<=bounds['y']+bounds['height']+2
  page.add_script_tag(url=ORIGIN+'/host-public/categories/panel.js',type='module')
  page.locator('#ryadom-category-trigger').click()
  page.get_by_role('button',name='Раздел «Где поесть», открыть подразделы',exact=True).click()
  page.get_by_role('button',name=re.compile('^Бургерные и стритфуд')).click()
  page.wait_for_function("decodeURIComponent(location.hash).includes('subcategory=Бургерные')")
  expect(page.get_by_role('group',name='Подкатегории',exact=True).get_by_role('button',name='Бургерные и стритфуд',exact=True)).to_have_attribute('aria-pressed','true')
  expect(page.get_by_role('heading',name='Бургерная «Мясорубка»',exact=True)).to_be_visible()
  expect(page.get_by_role('heading',name='Кафе «Домино»',exact=True)).to_have_count(0)
  # Beauty leaves open the public city/category list instead of an unfiltered Home search.
  page.goto(ORIGIN+'/#/home')
  page.add_script_tag(url=ORIGIN+'/host-public/categories/panel.js',type='module')
  page.locator('#ryadom-category-trigger').click()
  page.get_by_role('button',name='Раздел «Красота», открыть подразделы',exact=True).click()
  page.get_by_role('button',name=re.compile('^Уход за волосами')).click()
  page.wait_for_function("decodeURIComponent(location.hash).includes('/services?')&&decodeURIComponent(location.hash).includes('subcategory=Уход+за+волосами')")
  expect(page.get_by_role('group',name='Подкатегории',exact=True).get_by_role('button',name='Уход за волосами',exact=True)).to_have_attribute('aria-pressed','true')
  # The real React admin owns a single shared tree and opens photo cards immediately.
  admin_fixture=True
  page.goto(ORIGIN+'/tests/admin-photo-fixture.html')
  page.get_by_label('Город управления',exact=True).select_option('Город А')
  page.get_by_role('button',name=re.compile('^Где поесть:')).click()
  expect(page.locator('.admin-cms-card')).to_have_count(2)
  expect(page.locator('.admin-cms-card img')).to_have_count(2)
  expect(page.locator('.ryadm-interface')).to_have_count(0)
  group=page.get_by_role('group',name='Подкатегории организаций',exact=True)
  assert 'не опубликовано' not in group.inner_text()
  page.get_by_label('Подкатегория организации',exact=True).select_option(label='Бургерные и стритфуд')
  expect(page.locator('.admin-cms-card')).to_have_count(1)
  expect(page.locator('.admin-cms-card')).to_contain_text('Бургерная')
  page.get_by_role('button',name='Редактировать: Бургерная «Проба»',exact=True).click()
  expect(page.get_by_role('heading',name='Редактирование организации',exact=True)).to_be_visible()
  page.get_by_role('button',name='Отмена',exact=True).click()
  page.once('dialog',lambda dialog:dialog.accept())
  page.get_by_role('button',name='Удалить навсегда: Бургерная «Проба»',exact=True).click()
  expect(page.locator('.admin-cms-card')).to_have_count(0)
  assert not page.evaluate("JSON.parse(localStorage.getItem('catalog-fixture-data')).some(r=>r.id==='2')")
  page.get_by_label('Статус организации',exact=True).select_option('archived')
  expect(page.locator('.admin-cms-card')).to_have_count(0)
  # An editor's query is scoped at the API as well as in the UI.
  page.evaluate("localStorage.setItem('catalog-actor','editor')")
  page.reload()
  page.get_by_role('button',name=re.compile('^Где поесть:')).click()
  expect(page.locator('.admin-cms-card')).to_have_count(1)
  assert page.evaluate("window.catalogRequests.every(call=>call.filters.some(([key,value])=>key==='city'&&value.length===1&&value[0]==='Город А'))")
  assert not errors,errors
  print('PASS',width,'cover, photos, public route, single React admin, food dropdown, editing, permanent deletion, editor city scope')
  context.close()
 browser.close()
