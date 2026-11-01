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
  expect(page.get_by_role('heading',name='Истории рядом',exact=True)).to_have_count(0)
  expect(page.locator('.city-clock')).to_have_count(0)
  expect(page.get_by_role('heading',name='Новость Город А',exact=True)).to_be_visible()
  expect(page.get_by_role('heading',name='Объявление Город А',exact=True)).to_be_visible()
  page.wait_for_function("document.querySelector('.life-listing-image img')?.naturalWidth>0")
  expect(page.get_by_role('heading',name='Прошедшее событие',exact=True)).to_have_count(0)
  assert page.locator('.city-cover').bounding_box()['height']>=420
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  expect(page.get_by_role('group',name='Быстрые сценарии',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='Сегодня',exact=True)).to_be_visible()
  for link in page.locator('a[href^="/classifieds/"],a[href^="/wall/"],a[href^="#/add-organization"]').all():
   assert parse_qs(urlparse(link.get_attribute('href').replace('#/','/')).query).get('city')==['Город А']
  expect(page.get_by_role('link',name='+ Предложить новость',exact=True)).to_be_visible()
  expect(page.get_by_role('link',name='Добавить бесплатно',exact=True)).to_have_count(0)
  for heading in ['Город сегодня','Куда сходить','Нужное рядом']:
   assert page.get_by_role('heading',name=heading,exact=True).evaluate('(el)=>getComputedStyle(el,"::after").display')=='none'
  for shortcut in page.locator('.quick-discovery button').all():
   assert shortcut.evaluate('(el)=>getComputedStyle(el).backdropFilter')=='none'
   assert shortcut.evaluate('(el)=>getComputedStyle(el).backgroundColor')=='rgba(0, 0, 0, 0)'
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
  expect(page.locator('.city-clock')).to_be_visible()
  expect(page.locator('.city-clock-world')).to_be_visible()
  expect(page.locator('.winter-snow-toggle')).to_have_count(0)
  scene=page.locator('.cover-image')
  frame=scene.bounding_box()
  img=scene.locator(':scope>img')
  assert img.evaluate('el=>getComputedStyle(el).objectFit')=='cover'
  if width<900: assert abs(frame['width']/frame['height']-1)<.01,frame
  expect(page.locator('.city-clock-stand')).to_have_count(0)
  expect(page.locator('.city-clock-bracket')).to_be_visible()
  face=page.locator('.city-clock-dial').bounding_box()
  assert face['x']>=frame['x'] and face['x']+face['width']<=frame['x']+frame['width'],(face,frame)
  if width<900:
   content=page.locator('.city-cover-content').bounding_box()
   assert content['y']>=frame['y']+frame['height']-1,(content,frame)
  page.set_viewport_size({'width':width,'height':height+100})
  page.evaluate('scrollTo(0,100)')
  resized=scene.bounding_box()
  if width<900: assert abs(resized['width']-frame['width'])<1 and abs(resized['height']-frame['height'])<1,(frame,resized)
  else:
   content=page.locator('.city-cover-content').bounding_box()
   assert content['y']+content['height']<resized['y']+resized['height']-35,(content,resized)
  page.set_viewport_size({'width':width,'height':height})
  page.evaluate('scrollTo(0,0)')
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
  brand=page.locator('.app-header .brand-logo-image')
  expect(brand).to_have_attribute('src','/brand/ryadom-logo-winter-v3.svg')
  page.wait_for_function("document.querySelector('.app-header .brand-logo-image')?.naturalWidth>0")
  page.screenshot(path=f'qa-screenshots/home-life-{width}-{height}.png',full_page=True)
  print('PASS',width,'city isolation, links, search, category focus, hero, local photos, section order, no overflow, empty city')
  if width==390 and height==844:
   page.goto(ORIGIN+'/tests/home-life-fixture.html?stories=preview#/home?city=Город А')
   page.get_by_role('region',name='Пример историй жителей',exact=True).scroll_into_view_if_needed()
   expect(page.get_by_role('heading',name='Истории рядом',exact=True)).to_be_visible()
   expect(page.locator('.rs-card')).to_have_count(4)
   assert page.locator('.rs-preview').bounding_box()['y']<page.locator('.life-city-row').bounding_box()['y']
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
   page.locator('.rs-preview').scroll_into_view_if_needed()
   page.screenshot(path='qa-screenshots/stories-on-home-mobile.png',full_page=True)
   page.get_by_role('button',name='Открыть историю: На прогулке',exact=True).click()
   expect(page.get_by_role('dialog',name='Просмотр истории')).to_contain_text('Город А')
   page.keyboard.press('Escape')
   page.get_by_label('Тестовый город',exact=True).select_option('Город Б')
   expect(page.get_by_role('heading',name='Новость Город Б',exact=True)).to_be_visible()
   page.get_by_role('button',name='Открыть историю: На прогулке',exact=True).click()
   expect(page.get_by_role('dialog',name='Просмотр истории')).to_contain_text('Город Б')
   page.keyboard.press('Escape')
   assert not errors,errors
  if width==390 and height==844:
   page.emulate_media(reduced_motion='no-preference')
   snow=page.locator('.winter-snow')
   page.locator('.cover-image').scroll_into_view_if_needed()
   expect(page.locator('.winter-snow-toggle')).to_have_count(0)
   expect(snow).to_have_attribute('data-paused','false')
   layer=page.locator('.winter-snow-flakes>span').first
   initial=layer.evaluate('el=>getComputedStyle(el).transform')
   page.wait_for_function("before=>getComputedStyle(document.querySelector('.winter-snow-flakes>span')).transform!==before",arg=initial)
   page.get_by_role('heading',name='Город сегодня',exact=True).scroll_into_view_if_needed()
   expect(snow).to_have_attribute('data-paused','true')
   page.emulate_media(reduced_motion='reduce')
   expect(snow).not_to_be_visible()
   page.emulate_media(reduced_motion='no-preference')
   page.evaluate("document.documentElement.dataset.a11yMotion='reduce'")
   expect(snow).not_to_be_visible()
   page.evaluate('delete document.documentElement.dataset.a11yMotion')
   print('PASS winter: real CSS motion, pause offscreen, no visitor toggle, system and site reduced-motion settings')
  if width==1440:
   page.get_by_label('Тестовый город',exact=True).select_option('Енисейск')
   page.clock.install(time=datetime.datetime(2026,11,1,1,59,59,tzinfo=datetime.timezone.utc))
   page.reload()
   page.get_by_label('Тестовый город',exact=True).select_option('Енисейск')
   cover=page.locator('.city-cover .cover-image img')
   expect(cover).to_have_attribute('src','/brand/yeniseysk-winter-churches-on.webp')
   page.clock.fast_forward(2000)
   expect(cover).to_have_attribute('src','/brand/yeniseysk-winter-churches-off.webp')
   expect(page.locator('.city-clock')).to_have_attribute('data-lit','false')
   page.wait_for_function("document.querySelector('.cover-image img')?.naturalWidth>0")
   page.evaluate('scrollTo(0,0)')
   cover.evaluate('img=>img.decode()')
   cover.evaluate('img=>img.decode()')
   page.clock.run_for(250)  # Let the decoded image paint under the controlled browser clock.
   page.screenshot(path='qa-screenshots/winter-lamps-0900-off.png')
   hand=page.locator('.city-clock-world .city-clock-second')
   before=hand.get_attribute('transform')
   page.clock.fast_forward(1000)
   assert hand.get_attribute('transform')!=before
   page.clock.set_system_time(datetime.datetime(2026,11,1,11,59,59,tzinfo=datetime.timezone.utc))
   page.clock.fast_forward(2000)
   expect(cover).to_have_attribute('src','/brand/yeniseysk-winter-churches-on.webp')
   page.wait_for_function("document.querySelector('.cover-image img')?.naturalWidth>0")
   cover.evaluate('img=>img.decode()')
   page.clock.run_for(250)
   expect(page.locator('.city-clock')).to_have_attribute('data-lit','true')
   assert page.locator('.city-clock').get_attribute('data-time').startswith('19:00:')
   page.screenshot(path='qa-screenshots/winter-lamps-1900-on.png')
   page.add_style_tag(content='.app-header{background:#061b28;color:#fff8ea}')
   page.locator('.app-header .brand-logo-image').screenshot(path='qa-screenshots/winter-hat-v3.png')
   assert not errors,errors
   print('PASS winter lamps: 09:00 off, 19:00 on, automatic refresh of an open page')
  context.close()
 browser.close()
