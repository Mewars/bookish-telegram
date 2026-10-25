"""Actual React app + host shell; synthetic audio events, no external requests."""
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ORIGIN='http://127.0.0.1:4177'
FAKE_AUDIO=r'''(() => {
 window.__testAudio=[];
 window.Audio=class extends EventTarget {
  constructor(){super();this.src='';this.paused=true;this.volume=1;this.muted=false;this.plays=0;window.__testAudio.push(this)}
  play(){this.plays++;this.paused=false;return Promise.resolve()}
  pause(){if(!this.paused){this.paused=true;this.dispatchEvent(new Event('pause'))}}
  load(){}
 };
})();'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'))
 for width in (360,390,1440):
  context=browser.new_context(viewport={'width':width,'height':900})
  def route(request):
   if urlparse(request.request.url).path in ('/wall/','/classifieds/'):
    request.fulfill(status=200,content_type='text/html',body='<h1>Раздел города</h1><a href="/#/home">Главная</a><a href="/classifieds/">Объявления</a>')
   elif request.request.url.startswith(ORIGIN+'/'):
    request.continue_()
   else: request.abort()
  context.route('**/*',route)
  page=context.new_page();errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.add_init_script(FAKE_AUDIO)
  page.goto(ORIGIN+'/#/home')
  page.locator('.city-home').wait_for()
  cookies=page.get_by_role('button',name='Только необходимые',exact=True)
  if cookies.is_visible():cookies.click()
  # Organization cards now live in the catalog; Home has editorial navigation images.
  page.get_by_role('button',name='Места',exact=True).click()
  expect(page.locator('.app-shell')).to_have_attribute('data-section','places')
  assert page.locator('.card-image img[src^="data:image/svg"]').count()==0
  expect(page.locator('.card-image .photo-placeholder').first).to_be_visible()
  page.get_by_role('button',name='Главная',exact=True).click()
  page.locator('.city-home').wait_for()
  page.add_script_tag(path='host-public/ui/site-shell.js')
  assert page.evaluate('window.__testAudio.length')==0
  expect(page.locator('#music-player')).to_have_count(0)
  page.get_by_role('button',name='Открыть Музыку рядом',exact=True).click()
  page.get_by_role('button',name='Включить Музыку рядом',exact=True).click()
  expect(page.locator('.music-status')).to_contain_text('Подключаем эфир')
  expect(page.locator('.music-live')).to_have_count(0)
  page.evaluate("window.__testAudio[0].dispatchEvent(new Event('playing'))")
  expect(page.locator('.music-live')).to_have_count(1)
  page.get_by_role('button',name='Скрыть плеер, сохранив воспроизведение',exact=True).click()
  page.get_by_role('button',name='Места',exact=True).click()
  expect(page.locator('.app-shell')).to_have_attribute('data-section','places')
  assert page.evaluate('window.__testAudio.length')==1
  assert page.evaluate('window.__testAudio[0].paused') is False
  page.evaluate("window.ryadomOpenSection('/wall/')")
  dialog=page.get_by_role('dialog',name='Городской раздел РЯДОМ')
  expect(dialog).to_be_visible()
  expect(dialog.get_by_text('Плеер остаётся активным',exact=False)).to_have_count(0)
  expect(dialog.get_by_role('button',name='Открыть плеер',exact=True)).to_have_count(0)
  expect(dialog.locator('.ryadom-shell-bar')).to_have_count(0)
  expect(dialog.locator('.ryadom-shell-music')).to_have_count(0)
  expect(dialog.get_by_role('button')).to_have_count(0)
  assert page.evaluate('window.__testAudio[0].paused') is False
  page.frame_locator('.ryadom-shell-iframe').get_by_role('link',name='Главная',exact=True).click()
  expect(dialog).to_have_count(0)
  page.get_by_role('button',name='Открыть Музыку рядом',exact=True).click()
  expect(page.locator('#music-player')).to_be_visible()
  expect(page.get_by_role('slider',name='Громкость музыки')).to_have_count(0)
  page.get_by_role('button',name='Раскрыть настройки музыки',exact=True).click()
  volume=page.get_by_role('slider',name='Громкость музыки')
  volume.press('Home');volume.press('ArrowRight')
  assert page.evaluate('window.__testAudio[0].volume')==0.01
  page.get_by_role('button',name='Отключить звук',exact=True).click()
  assert page.evaluate('window.__testAudio[0].muted') is True
  page.get_by_role('button',name='Приостановить Музыку рядом',exact=True).click()
  assert page.evaluate('window.__testAudio[0].paused') is True
  page.get_by_role('button',name='Включить Музыку рядом',exact=True).click()
  page.evaluate("window.__testAudio[0].dispatchEvent(new Event('playing'))")
  page.evaluate("window.ryadomOpenSection('/wall/')")
  # Real iframe link changes section without remounting the parent audio player.
  page.frame_locator('.ryadom-shell-iframe').get_by_role('link',name='Объявления',exact=True).click()
  expect(page.locator('.ryadom-shell-iframe')).to_have_attribute('src','/classifieds/?ryadom_embed=1')
  assert page.evaluate('window.__testAudio.length')==1
  assert page.evaluate('window.__testAudio[0].paused') is False
  page.evaluate("window.__testAudio[0].dispatchEvent(new Event('error'))")
  expect(dialog.locator('.ryadom-shell-bar')).to_have_count(0)
  page.frame_locator('.ryadom-shell-iframe').get_by_role('link',name='Главная',exact=True).click()
  expect(page.get_by_role('button',name='Включить Музыку рядом',exact=True)).to_be_visible()
  assert not errors,errors
  print('PASS',width,'single audio; truthful states; route/iframe continuity; pause/mute/volume; no banner or overflow')
  context.close()
 browser.close()
