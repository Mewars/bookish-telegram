"""Synthetic provider only. No real CAPTCHA is loaded or solved."""
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width in (360,1440):
  context=browser.new_context(viewport={'width':width,'height':900})
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:4178/') else r.abort())
  context.add_init_script("""window.widgetMode='interactive';window.renderOptions=[];window.turnstile={render(node,options){window.renderOptions.push(options.appearance);if(window.widgetMode==='silent'){queueMicrotask(()=>options.callback('synthetic-token'));return 'synthetic-widget';}if(window.widgetMode==='background-fail'){queueMicrotask(()=>options['error-callback']());return 'synthetic-widget';}options['before-interactive-callback']();const ok=document.createElement('button');ok.textContent='Synthetic pass';ok.onclick=()=>options.callback('synthetic-token');const fail=document.createElement('button');fail.textContent='Synthetic failure';fail.onclick=()=>options['error-callback']();node.append(ok,fail);return 'synthetic-widget';},remove(){}};""")
  page=context.new_page();page.goto('http://127.0.0.1:4178/tests/antispam-fixture.html')
  expect(page.locator('vite-error-overlay')).to_have_count(0)
  page.get_by_role('button',name='Отправить объявление',exact=True).click()
  panel=page.get_by_role('region',name='Проверка безопасности',exact=True)
  expect(panel).to_be_visible()
  bounds=panel.bounding_box();assert bounds['x']>=0 and bounds['x']+bounds['width']<=width
  page.get_by_role('button',name='Отмена',exact=True).click()
  expect(page.get_by_role('textbox',name='Текст объявления')).to_have_value('Не потерять введённый текст')
  assert page.evaluate('window.verificationCalls.length')==0
  page.get_by_role('button',name='Отправить объявление',exact=True).click()
  page.get_by_role('button',name='Synthetic failure',exact=True).click()
  expect(page.get_by_role('status')).to_contain_text('не пройдена')
  assert page.evaluate('window.verificationCalls.length')==0
  page.get_by_role('button',name='Отправить объявление',exact=True).click()
  page.get_by_role('button',name='Synthetic pass',exact=True).click()
  expect(page.get_by_role('status')).to_have_text('Отправлено')
  calls=page.evaluate('window.verificationCalls');assert calls==[{'name':'ryadom-antispam','token':'synthetic-token','action':'classified','resource_id':'synthetic-row'}]
  # Ordinary checks finish without a region, dialog, cancel button, or focus theft.
  page.evaluate("window.widgetMode='silent'")
  page.get_by_role('button',name='Войти',exact=True).click()
  expect(page.get_by_role('status')).to_have_text('auth: synthetic-token')
  assert page.evaluate('window.verificationCalls.length')==1
  expect(panel).to_have_count(0)
  expect(page.get_by_role('dialog')).to_have_count(0)
  expect(page.get_by_role('button',name='Отмена',exact=True)).to_have_count(0)
  expect(page.get_by_role('button',name='Войти',exact=True)).to_be_focused()
  # Background success still must reach the server for each content operation.
  page.get_by_role('button',name='Отправить объявление',exact=True).click()
  expect(page.get_by_role('status')).to_have_text('Отправлено')
  assert page.evaluate('window.verificationCalls.length')==2
  page.evaluate("window.widgetMode='background-fail'")
  page.get_by_role('button',name='Отправить объявление',exact=True).click()
  expect(page.get_by_role('status')).to_contain_text('не пройдена')
  assert page.evaluate('window.verificationCalls.length')==2
  expect(page.get_by_role('textbox',name='Текст объявления')).to_have_value('Не потерять введённый текст')
  assert all(mode=='interaction-only' for mode in page.evaluate('window.renderOptions'))
  print('PASS',width,'silent auth/content, interactive cancel/retry, server checks, background failure preserves text')
  context.close()
 browser.close()
