"""Interactive visual trial: local photos, no uploads/auth/database mutations."""
import base64
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
ORIGIN='http://127.0.0.1:4178'
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')
Path('qa-screenshots').mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width,height in [(360,740),(390,844),(1440,900)]:
  context=browser.new_context(viewport={'width':width,'height':height},locale='ru-RU',reduced_motion='reduce')
  requests=[];errors=[]
  def route(r):
   requests.append((r.request.method,r.request.url))
   if r.request.url.startswith(ORIGIN+'/'):r.continue_()
   else:r.abort()
  context.route('**/*',route)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(ORIGIN+'/stories-preview/?city=Лесосибирск')
  expect(page.get_by_role('heading',name='Истории рядом')).to_be_visible()
  expect(page.locator('.rs-card')).to_have_count(4)
  assert 'Лесосибирск' in page.locator('#on-home').get_attribute('href') or '%D0%9B' in page.locator('#on-home').get_attribute('href')
  page.get_by_role('button',name='Открыть историю: На прогулке',exact=True).click()
  dialog=page.get_by_role('dialog',name='Просмотр истории')
  expect(dialog).to_be_visible();expect(dialog).to_contain_text('Лесосибирск')
  expect(dialog.get_by_role('button',name='Продолжить')).to_be_visible()
  page.keyboard.press('ArrowRight');expect(dialog.get_by_text('Время для небольшой паузы',exact=True)).to_be_visible()
  page.keyboard.press('ArrowLeft');expect(dialog.get_by_text('Красота рядом',exact=True)).to_be_visible()
  page.keyboard.press('Escape');expect(dialog).to_have_count(0)
  expect(page.get_by_role('button',name='Открыть историю: На прогулке',exact=True)).to_be_focused()
  page.get_by_role('button',name='Примерить свою историю').click()
  form=page.get_by_role('dialog',name='Примерить свою историю')
  form.get_by_label('Фото · JPG, PNG или WebP, до 10 МБ').set_input_files({'name':'own.png','mimeType':'image/png','buffer':PNG})
  form.get_by_label('Подпись',exact=True).fill('<script>alert(1)</script> Моё фото')
  form.get_by_role('button',name='Посмотреть свою историю',exact=True).click()
  expect(dialog).to_be_visible();expect(dialog.get_by_text('<script>alert(1)</script> Моё фото',exact=True)).to_be_visible()
  assert dialog.locator('script').count()==0
  assert dialog.locator('img').get_attribute('src').startswith('blob:')
  dialog.get_by_role('button',name='Убрать своё фото',exact=True).click()
  expect(dialog).to_have_count(0);expect(page.locator('.rs-card')).to_have_count(4)
  page.get_by_role('button',name='Примерить свою историю').click()
  form.get_by_label('Фото · JPG, PNG или WebP, до 10 МБ').set_input_files({'name':'broken.png','mimeType':'image/png','buffer':b'not an image'})
  form.get_by_role('button',name='Посмотреть свою историю',exact=True).click()
  expect(form.get_by_role('alert')).to_contain_text('Не удалось открыть')
  page.keyboard.press('Escape')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  page.screenshot(path=f'qa-screenshots/stories-preview-{width}.png',full_page=True)
  page.get_by_role('button',name='Открыть историю: На прогулке',exact=True).click()
  page.screenshot(path=f'qa-screenshots/stories-viewer-{width}.png',full_page=True)
  page.keyboard.press('Escape');page.reload();expect(page.locator('.rs-card')).to_have_count(4)
  assert all(method=='GET' for method,url in requests),requests
  assert all(urlparse(url).netloc=='127.0.0.1:4178' for method,url in requests),requests
  assert not errors,errors
  context.close()
 browser.close()
print('PASS: stories preview mobile/desktop, local photos, escaping, focus, keyboard, no uploads or persistence')
