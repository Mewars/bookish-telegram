"""Real native canvas/recorder with fake camera and synthetic moderation API; no Production writes."""
from pathlib import Path
import math,struct,wave,tempfile
from playwright.sync_api import sync_playwright,expect
ORIGIN='http://127.0.0.1:4178'
Path('qa-screenshots').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 track=Path(tmp)/'owned-test-tone.wav'
 with wave.open(str(track),'wb') as audio:
  audio.setparams((1,2,22050,0,'NONE','not compressed'))
  audio.writeframes(b''.join(struct.pack('<h',int(math.sin(i*2*math.pi*440/22050)*500)) for i in range(22050*5)))
 browser=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
 for width,height in [(390,844),(1440,900)]:
  context=browser.new_context(viewport={'width':width,'height':height},locale='ru-RU',permissions=['camera','microphone'],reduced_motion='reduce')
  def route(req):
   path=req.request.url.removeprefix(ORIGIN)
   if path.startswith('/wall/'):
    source=Path('host-public')/path.split('?')[0].lstrip('/')
    req.fulfill(path=source) if source.is_file() else req.abort()
   elif req.request.url.startswith(ORIGIN+'/'):req.continue_()
   else:req.abort()
  context.route('**/*',route)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(ORIGIN+'/tests/stories-live-fixture.html?video=1&instant=1')
  page.get_by_label('Тестовый пользователь',exact=True).select_option('resident')
  page.get_by_role('button',name='Добавить историю',exact=True).click()
  form=page.get_by_role('dialog',name='Добавить историю',exact=True)
  form.get_by_label('Фото или видео · до 30 секунд',exact=True).set_input_files('public/brand/discovery/park.webp')
  expect(form.get_by_text('Фото готово. Добавьте надпись или стикеры.',exact=True)).to_be_visible()
  form.get_by_text('Надписи и стикеры',exact=True).click()
  form.get_by_label('Текст на истории',exact=True).fill('Мой город')
  form.get_by_role('button',name='Добавить надпись',exact=True).click()
  form.get_by_role('button',name='Стикеры и эмодзи',exact=True).click()
  form.get_by_role('button',name='Привет!',exact=True).click()
  expect(form.get_by_label('Выбранный элемент',exact=True).locator('option')).to_have_count(2)
  form.get_by_label('Положение по горизонтали',exact=True).fill('70')
  form.get_by_text('Музыка из файла',exact=True).click()
  form.get_by_label('Аудиофайл · до 20 МБ',exact=True).set_input_files(str(track))
  form.get_by_label('Длительность фото с музыкой · 3–30 секунд',exact=True).fill('3')
  form.get_by_label('Подпись',exact=True).fill('Фото с музыкой')
  page.screenshot(path=f'qa-screenshots/stories-editor-{width}.png',full_page=True)
  form.get_by_role('button',name='Опубликовать историю',exact=True).click()
  expect(form).to_have_count(0,timeout=20000)
  expect(page.get_by_role('button',name='История: Житель',exact=True)).to_be_visible()
  expect(page.get_by_text('24 часа',exact=True)).to_have_count(0)
  page.get_by_label('Тестовый пользователь',exact=True).select_option('guest')
  page.get_by_role('button',name='История: Житель',exact=True).click()
  viewer=page.get_by_role('dialog',name='Просмотр истории',exact=True)
  expect(viewer.locator('video')).to_be_visible()
  expect(viewer.get_by_role('button',name='Включить звук',exact=True)).to_be_visible()
  expect(viewer.get_by_role('button',name='Опубликовать',exact=True)).to_have_count(0)
  page.wait_for_function("document.querySelector('.rs-viewer video')?.videoWidth===720")
  viewer.get_by_role('button',name='Закрыть историю',exact=True).click()
  page.get_by_label('Тестовый пользователь',exact=True).select_option('resident')
  page.get_by_role('button',name='Снять историю',exact=True).click()
  expect(form.get_by_role('button',name='Начать запись',exact=True)).to_be_enabled()
  form.get_by_role('button',name='Начать запись',exact=True).click()
  page.wait_for_timeout(1200) # Real recording needs time to produce media.
  form.get_by_role('button',name='Остановить запись',exact=True).click()
  expect(form.get_by_text('Видео готово. Добавьте надпись или стикеры.',exact=True)).to_be_visible(timeout=15000)
  form.get_by_label('Подпись',exact=True).fill('Запись камеры')
  form.get_by_role('button',name='Опубликовать историю',exact=True).click()
  expect(form).to_have_count(0,timeout=20000)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  assert not errors,errors
  context.close()
 browser.close()
print('PASS: real composited photo/music and camera recording publish directly; guest video view at 390/1440')
