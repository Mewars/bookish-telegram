from pathlib import Path
from playwright.sync_api import sync_playwright, expect

SDK=Path('tests/host-wall-sdk.mjs').read_text()
URL='http://127.0.0.1:4176/wall/'
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width in (390,1440):
  context=browser.new_context(viewport={'width':width,'height':900})
  page=context.new_page()
  def route(request):
   if '/wall/supabase-client.js' in request.request.url:
    request.fulfill(status=200,content_type='text/javascript',body=SDK)
   elif request.request.url.startswith('http://127.0.0.1:4176/'):
    request.continue_()
   else:
    request.abort()
  page.route('**/*',route)
  page.add_init_script("if(!localStorage.getItem('wall-test-actor'))localStorage.setItem('wall-test-actor','owner')")
  page.goto(URL+'?view=admin')
  expect(page.get_by_role('button',name='Отклонить',exact=True)).to_be_visible()
  page.get_by_role('button',name='Отклонить',exact=True).click()
  reason='Добавьте адрес <script>window.bad=true</script>'
  page.get_by_label('Причина отказа',exact=True).fill(reason)
  page.get_by_role('button',name='Отклонить с причиной',exact=True).click()
  expect(page.locator('#flash')).to_contain_text('Запись отклонена')
  page.evaluate("localStorage.setItem('wall-test-actor','resident')")
  page.goto(URL)
  page.get_by_role('button',name='Мои записи',exact=True).click()
  expect(page.get_by_text('Причина отказа: '+reason,exact=True)).to_be_visible()
  assert page.evaluate('Boolean(window.bad)') is False
  page.get_by_role('button',name='Редактировать и добавить медиа',exact=True).click()
  page.get_by_label('Заголовок',exact=True).fill('Исправленная запись жителя')
  page.get_by_label('Текст записи',exact=True).fill('Подробный исправленный текст с адресом для проверки.')
  page.get_by_role('button',name='Сохранить изменения',exact=True).click()
  expect(page.locator('.badge.draft')).to_be_visible()
  page.get_by_role('button',name='Отправить',exact=True).click()
  expect(page.locator('.badge.pending')).to_be_visible()
  page.get_by_role('button',name='Лента',exact=True).click()
  expect(page.get_by_role('heading',name='Исправленная запись жителя')).to_have_count(0)
  page.evaluate("localStorage.setItem('wall-test-actor','owner')")
  page.goto(URL+'?view=admin')
  page.get_by_role('button',name='Опубликовать',exact=True).click()
  expect(page.locator('#flash')).to_contain_text('Запись опубликована')
  page.evaluate("localStorage.setItem('wall-test-actor','resident')")
  page.goto(URL)
  expect(page.get_by_role('heading',name='Исправленная запись жителя')).to_be_visible()
  page.locator('#city').select_option('Лесосибирск')
  expect(page.get_by_role('heading',name='Исправленная запись жителя')).to_have_count(0)
  # A new resident post is sent to review rather than appearing in the feed.
  page.get_by_role('navigation',name='Разделы стены').get_by_role('button',name='Предложить запись',exact=True).click()
  page.get_by_label('Заголовок',exact=True).fill('Новая запись другого города')
  page.get_by_label('Текст записи',exact=True).fill('Новый текст жителя должен пройти модерацию владельца.')
  page.evaluate('window.wallSubmitFailures=1;window.wallVerificationCount=0')
  page.get_by_role('button',name='Отправить запись',exact=True).click()
  expect(page.locator('#flash')).to_contain_text('Synthetic retry required')
  expect(page.get_by_label('Заголовок',exact=True)).to_have_value('Новая запись другого города')
  page.get_by_role('button',name='Отправить запись',exact=True).click()
  expect(page.locator('.badge.pending')).to_be_visible()
  assert page.evaluate('window.wallVerificationCount')==2
  expect(page.get_by_role('heading',name='Новая запись другого города',exact=True)).to_have_count(1)
  page.get_by_role('button',name='Лента',exact=True).click()
  expect(page.get_by_role('heading',name='Новая запись другого города')).to_have_count(0)
  print('PASS resident wall moderation, private reason, revision, resubmission and city isolation:',width)
  context.close()
 browser.close()
