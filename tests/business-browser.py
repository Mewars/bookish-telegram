"""Isolated business flow: no production network, real identities, uploads or writes."""
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
ORIGIN='http://127.0.0.1:4178'
Path('qa-screenshots').mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width,height in [(360,740),(390,664),(768,1024),(1440,900)]:
  context=browser.new_context(viewport={'width':width,'height':height},locale='ru-RU')
  guest=False
  def route(r):
   path=urlparse(r.request.url).path
   if path=='/src/lib/supabase.ts':r.fulfill(content_type='text/javascript',body="import {c} from '/tests/business-sdk.mjs';export const supabase=c();")
   elif path=='/src/hooks/useAuth.ts':r.fulfill(content_type='text/javascript',body="export function useAuth(){return {state:{status:'"+('anonymous' if guest else 'authenticated')+"',user:"+('null' if guest else "{id:'business-test-user'}")+"}};}")
   elif r.request.url.startswith(ORIGIN+'/'):r.continue_()
   else:r.abort()
  context.route('**/*',route)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(ORIGIN+'/tests/business-fixture.html#/business?city=Город%20А')
  expect(page.get_by_role('heading',name='Ваш бизнес — рядом с клиентами.')).to_be_visible()
  page.wait_for_function("document.querySelector('.business-example img')?.naturalWidth>0")
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  page.screenshot(path=f'qa-screenshots/business-{width}.png',full_page=True)
  for link in page.locator('a[href^="#/add-organization"]').all():
   assert parse_qs(urlparse(link.get_attribute('href').replace('#/','/')).query)['city']==['Город А']
  for link in page.locator('a[target="_blank"]').all():
   assert link.get_attribute('href')=='https://vk.me/ryadomcity'
   assert 'noopener' in link.get_attribute('rel')
  page.get_by_text('Нужно ли платить за появление в каталоге?',exact=True).click()
  expect(page.get_by_text('Нет. Базовое размещение бесплатно.',exact=False)).to_be_visible()
  page.get_by_role('link',name='Запросить оформление',exact=True).click()
  expect(page.get_by_role('heading',name='Оформление новой карточки',exact=True)).to_be_visible()
  expect(page.get_by_label('Город *',exact=True)).to_have_value('Город А')
  page.get_by_label('Название организации *',exact=True).fill('Тестовая организация')
  page.get_by_label('Категория *',exact=True).select_option(index=1)
  page.get_by_label('Адрес *',exact=True).fill('Тестовый адрес')
  page.get_by_label('Описание *',exact=True).fill('Синтетическая заявка, не отправляется в рабочую базу.')
  page.get_by_label('Источник информации *',exact=True).fill('Предоставляю сведения своей организации для проверки.')
  page.get_by_role('button',name='Отправить на рассмотрение',exact=True).click()
  expect(page.locator('#error-consent')).to_be_visible()
  assert page.evaluate("async()=> (await import('/tests/business-sdk.mjs')).submissions().length")==0
  page.locator('#organization-consent').check()
  page.get_by_role('button',name='Отправить на рассмотрение',exact=True).click()
  expect(page.get_by_role('heading',name='Заявка отправлена',exact=True)).to_be_visible()
  calls=page.evaluate("async()=> (await import('/tests/business-sdk.mjs')).submissions()")
  assert len(calls)==1
  payload=calls[0]['value']
  assert payload['city']=='Город А' and payload['applicant_id']=='business-test-user'
  assert payload['source_note'].startswith('Запрос помощи с оформлением новой карточки.')
  assert not set(['status','role','organization_id','review_message','paid_until','plan'])&set(payload)
  page.get_by_role('button',name='Мои заявки',exact=True).click()
  expect(page.get_by_role('heading',name='Тестовая организация',exact=True)).to_be_visible()
  page.goto(ORIGIN+'/tests/business-fixture.html#/business?city=Город%20Б')
  expect(page.get_by_text('РЯДОМ ДЛЯ БИЗНЕСА · Город Б',exact=True)).to_be_visible()
  page.get_by_role('link',name='Добавить бесплатно',exact=True).click()
  expect(page.get_by_role('heading',name='Добавить организацию',exact=True)).to_be_visible()
  expect(page.get_by_label('Город *',exact=True)).to_have_value('Город Б')
  assert page.locator('.organization-design-note').count()==0
  guest=True;page.reload()
  expect(page.get_by_role('heading',name='Войдите для подачи заявки',exact=True)).to_be_visible()
  expect(page.locator('form')).to_have_count(0)
  assert not errors,errors
  print('PASS',width,'layout, illustration, city links, design submission, consent, no privileges, basic form, guest')
  context.close()
 browser.close()
