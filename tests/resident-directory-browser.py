"""Real React directory UI, synthetic API, no Production data or geolocation."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ORIGIN='http://127.0.0.1:4178'
Path('qa-screenshots').mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width,height in [(390,844),(1440,900)]:
  context=browser.new_context(viewport={'width':width,'height':height},locale='ru-RU')
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(ORIGIN+'/') else r.abort())
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(ORIGIN+'/tests/resident-directory-fixture.html')
  expect(page.get_by_text('Ваш профиль скрыт из поиска.',exact=True)).to_be_visible()
  page.get_by_role('button',name='Разрешить находить меня в этом городе',exact=True).click()
  expect(page.get_by_role('button',name='Скрыть меня из поиска',exact=True)).to_be_visible()
  page.get_by_role('button',name='Найти жителей',exact=True).click()
  expect(page.get_by_role('heading',name='Тестовый житель',exact=True)).to_be_visible()
  page.get_by_role('button',name='Добавить в друзья',exact=True).click()
  expect(page.get_by_text('Заявка отправлена. Дружба начнётся после подтверждения.',exact=True)).to_be_visible()
  page.get_by_role('button',name='Найти жителей',exact=True).click()
  expect(page.get_by_text('Заявка отправлена',exact=True)).to_be_visible()
  page.screenshot(path=f'qa-screenshots/resident-directory-{width}.png',full_page=True)
  page.get_by_role('button',name='Скрыть меня из поиска',exact=True).click()
  expect(page.get_by_text('Ваш профиль скрыт из поиска.',exact=True)).to_be_visible()
  page.get_by_label('Тестовый город',exact=True).select_option('Город Б')
  expect(page.get_by_role('heading',name='Тестовый житель',exact=True)).to_have_count(0)
  page.get_by_role('button',name='Найти жителей',exact=True).click()
  expect(page.get_by_text('Жителей, разрешивших поиск с таким именем, пока нет.',exact=True)).to_be_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  assert not errors,errors
  context.close()
 browser.close()
print('PASS: opt-in/out, request, pending state, city isolation, no geolocation, 390/1440')
