"""Actual footer role checks and the shared scroll button, without real Auth or writes."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ORIGIN='http://127.0.0.1:4178'
Path('qa-screenshots').mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width,height in [(390,844),(1440,900)]:
  context=browser.new_context(viewport={'width':width,'height':height},locale='ru-RU',reduced_motion='reduce')
  def route(r):
   if r.request.url.startswith(ORIGIN+'/src/lib/supabase.ts'):r.fulfill(content_type='text/javascript',body="import {client} from '/tests/mobile-polish-sdk.mjs';export const supabase=client;")
   elif r.request.url.startswith(ORIGIN+'/'):r.continue_()
   else:r.abort()
  context.route('**/*',route);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(ORIGIN+'/tests/mobile-polish-fixture.html')
  admin=page.get_by_role('button',name='Административная панель',exact=True)
  expect(admin).to_have_count(0)
  page.get_by_label('Тестовая роль').select_option('resident');expect(admin).to_have_count(0)
  page.get_by_label('Тестовая роль').select_option('editor');expect(admin).to_have_count(1)
  page.get_by_label('Тестовый город').select_option('Город Б');expect(admin).to_have_count(0)
  page.get_by_label('Тестовая роль').select_option('owner');expect(admin).to_have_count(1)
  page.get_by_label('Тестовая роль').select_option('guest');expect(admin).to_have_count(0)
  top=page.get_by_role('button',name='Наверх',exact=True);expect(top).not_to_be_visible()
  page.get_by_role('heading',name='Информация',exact=True).scroll_into_view_if_needed();expect(top).to_be_visible()
  assert top.bounding_box()['y']+top.bounding_box()['height']<height-85 if width<900 else True
  page.screenshot(path=f'qa-screenshots/footer-and-top-{width}.png',full_page=False)
  a=top.bounding_box();b=page.get_by_role('button',name='Тестовые уведомления',exact=True).bounding_box()
  assert a['x']+a['width']<=b['x'] or b['x']+b['width']<=a['x'] or a['y']+a['height']<=b['y'] or b['y']+b['height']<=a['y'],(a,b)
  top.click();page.wait_for_function('scrollY<5');expect(top).not_to_be_visible()
  expect(page.get_by_role('heading',name='Тест страницы',exact=True)).to_be_focused()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  assert not errors,errors
  context.close()
 browser.close()
print('PASS: guest/resident/own-city editor/global owner footer visibility; accessible scroll to top at 390/1440')
