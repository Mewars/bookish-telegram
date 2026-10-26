"""Synthetic homepage scenarios; no real users, writes or external traffic."""
import base64
import datetime
import json
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
ORIGIN='http://127.0.0.1:4178'
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')
Path('qa-screenshots').mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width,height in [(360,740),(390,664),(390,844),(768,1024),(1440,900)]:
  context=browser.new_context(viewport={'width':width,'height':height},locale='ru-RU',reduced_motion='reduce')
  news_requests=[]
  def route(r):
   u=urlparse(r.request.url)
   if u.path=='/src/lib/supabase.ts':r.fulfill(content_type='text/javascript',body="import {c} from '/tests/home-life-sdk.mjs';export const supabase=c();")
   elif u.path=='/feeds/calendar-ru.json':r.fulfill(content_type='application/json',body=json.dumps({'sourceUrl':'https://www.calend.ru/holidays/russtate/','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'items':[{'title':'Тестовый российский праздник','date':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date().isoformat(),'sourceUrl':'https://www.calend.ru/holidays/0/0/3998/'}]}))
   elif u.path=='/news/eniseysk.json':news_requests.append(r.request.url);r.fulfill(status=404,body='News paused')
   elif u.path=='/tests/photo-valid.png':r.fulfill(content_type='image/png',body=PNG)
   elif r.request.url.startswith(ORIGIN+'/'):r.continue_()
   else:r.abort()
  context.route('**/*',route)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(ORIGIN+'/tests/home-life-fixture.html#/home?city='+ 'Город А')
  expect(page.get_by_role('heading',name='Новость Город А',exact=True)).to_be_visible()
  expect(page.get_by_role('heading',name='Объявление Город А',exact=True)).to_be_visible()
  page.wait_for_function("document.querySelector('.life-listing-image img')?.naturalWidth>0")
  expect(page.get_by_role('heading',name='Прошедшее событие',exact=True)).to_have_count(0)
  assert abs(page.locator('.city-cover').evaluate('(el)=>el.getBoundingClientRect().bottom+scrollY')-height)<3
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  expect(page.get_by_role('group',name='Быстрые сценарии',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='Сегодня',exact=True)).to_be_visible()
  for link in page.locator('a[href^="/classifieds/"],a[href^="/wall/"],a[href^="#/add-organization"]').all():
   assert parse_qs(urlparse(link.get_attribute('href').replace('#/','/')).query).get('city')==['Город А']
  expect(page.get_by_role('link',name='+ Предложить новость',exact=True)).to_be_visible()
  expect(page.get_by_role('link',name='Добавить бесплатно',exact=True)).to_have_count(0)
  assert page.get_by_role('heading',name='Город сегодня',exact=True).evaluate('(el)=>getComputedStyle(el,"::after").display')=='none'
  page.get_by_role('button',name='Сегодня',exact=True).click()
  expect(page.get_by_role('heading',name='Тестовый российский праздник',exact=True)).to_be_visible()
  page.get_by_role('button',name='Сбросить',exact=True).click()
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
  page.get_by_label('Тестовый город',exact=True).select_option('Енисейск')
  expect(page.get_by_role('heading',name='Новость Енисейск',exact=True)).to_be_visible()
  expect(page.get_by_role('heading',name='Новости города',exact=True)).to_have_count(0)
  assert not news_requests,news_requests
  tiles=page.locator('.life-collection')
  expect(tiles).to_have_count(3)
  assert page.locator('.life-collection h3').all_text_contents()==['На прогулку','Кофе и встречи','История и культура']
  for index,name in enumerate(['park','coffee','culture']):
   photo=tiles.nth(index).locator('img')
   expect(photo).to_have_attribute('src','/brand/discovery/eniseysk-'+name+'.webp')
   photo.scroll_into_view_if_needed()
  page.wait_for_function("[...document.querySelectorAll('.life-collection img')].every(img=>img.complete&&img.naturalWidth>0)")
  expect(page.locator('.life-collection .life-art-label')).to_have_count(0)
  order=page.locator('.life-content').evaluate("el=>[...el.children].map(node=>node.getAttribute('aria-label')||(node.classList.contains('life-city-row')?'wall':node.classList.contains('life-business')?'business':''))")
  assert order.index('Открывай город по-новому')<order.index('wall')<order.index('Афиша города')<order.index('Свежие объявления'),order
  assert order[-1]=='Свежие объявления',order
  boxes=[tiles.nth(i).bounding_box() for i in range(3)]
  assert page.locator('.life-city-row').bounding_box()['y']-max(box['y']+box['height'] for box in boxes)>=31
  assert max(box['height'] for box in boxes)-min(box['height'] for box in boxes)<2,boxes
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  assert not errors,errors
  page.screenshot(path=f'qa-screenshots/home-life-{width}-{height}.png',full_page=True)
  print('PASS',width,'city isolation, links, search, category focus, hero, local photos, section order, no overflow, empty city')
  context.close()
 browser.close()
