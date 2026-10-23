"""Synthetic homepage scenarios; no real users, writes or external traffic."""
import base64
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
ORIGIN='http://127.0.0.1:4178'
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')
Path('qa-screenshots').mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width,height in [(360,740),(390,844),(768,1024),(1440,900)]:
  context=browser.new_context(viewport={'width':width,'height':height},locale='ru-RU',reduced_motion='reduce')
  def route(r):
   u=urlparse(r.request.url)
   if u.path=='/src/lib/supabase.ts':r.fulfill(content_type='text/javascript',body="import {c} from '/tests/home-life-sdk.mjs';export const supabase=c();")
   elif u.path=='/tests/photo-valid.png':r.fulfill(content_type='image/png',body=PNG)
   elif r.request.url.startswith(ORIGIN+'/'):r.continue_()
   else:r.abort()
  context.route('**/*',route)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(ORIGIN+'/tests/home-life-fixture.html#/home?city='+ 'Город А')
  expect(page.get_by_role('heading',name='Новость Город А',exact=True)).to_be_visible()
  expect(page.get_by_role('heading',name='Объявление Город А',exact=True)).to_be_visible()
  expect(page.get_by_role('heading',name='Прошедшее событие',exact=True)).to_have_count(0)
  assert abs(page.locator('.city-cover').evaluate('(el)=>el.getBoundingClientRect().bottom+scrollY')-height)<3
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  for link in page.locator('a[href^="/classifieds/"],a[href^="/wall/"],a[href^="#/add-organization"]').all():
   assert parse_qs(urlparse(link.get_attribute('href').replace('#/','/')).query).get('city')==['Город А']
  page.locator('#ryadom-category-trigger').click()
  dialog=page.get_by_role('dialog',name='Все категории',exact=True);expect(dialog).to_be_visible()
  page.keyboard.press('Escape');expect(dialog).not_to_be_visible()
  expect(page.locator('#ryadom-category-trigger')).to_be_focused()
  search=page.get_by_role('searchbox',name='Поиск',exact=True)
  search.fill('Кофейня');search.press('Enter')
  expect(page.locator('#city-selections .card')).to_have_count(1)
  page.get_by_role('button',name='Очистить поиск',exact=True).click()
  expect(page.get_by_role('heading',name='Город сегодня',exact=True)).to_be_visible()
  page.get_by_label('Тестовый город',exact=True).select_option('Город Б')
  expect(page.get_by_role('heading',name='Новость Город Б',exact=True)).to_be_visible()
  expect(page.get_by_role('heading',name='Объявление Город А',exact=True)).to_have_count(0)
  page.get_by_label('Тестовый город',exact=True).select_option('Пустой город')
  expect(page.get_by_role('heading',name='Город начинается с нас',exact=True)).to_be_visible()
  expect(page.get_by_role('heading',name='Объявления рядом',exact=True)).to_have_count(0)
  expect(page.get_by_role('heading',name='Куда сходить',exact=True)).to_have_count(0)
  assert not errors,errors
  page.screenshot(path=f'qa-screenshots/home-life-{width}.png',full_page=True)
  print('PASS',width,'city isolation, links, search, category focus, hero, no overflow, empty city')
  context.close()
 browser.close()
