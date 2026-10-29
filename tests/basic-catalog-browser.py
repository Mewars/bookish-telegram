"""Synthetic categories and basic card, no real user or database writes."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ORIGIN='http://127.0.0.1:4178'
Path('qa-screenshots').mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width,height in [(360,740),(390,664),(1440,900)]:
  context=browser.new_context(viewport={'width':width,'height':height},locale='ru-RU')
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(ORIGIN+'/') else r.abort())
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(ORIGIN+'/tests/basic-catalog-fixture.html')
  expect(page.locator('.card')).to_have_count(5)
  expect(page.get_by_role('heading',name='Чужой салон',exact=True)).to_have_count(0)
  expect(page.locator('.card').first.locator('.card-meta').first).to_be_visible()
  expect(page.locator('.card').first.locator('.card-footer')).to_be_visible()
  assert page.locator('.card-body').get_by_text('Скрытое расширенное описание',exact=True).count()==0
  group=page.get_by_role('group',name='Подкатегории',exact=True)
  for label,title in [('Уход за лицом','Лицо'),('Уход за волосами','Волосы'),('Уход за телом','Тело'),('Ногтевые услуги','Ногти')]:
   group.get_by_role('button',name=label,exact=True).click()
   expect(page.locator('.card')).to_have_count(1)
   expect(page.get_by_role('heading',name=title,exact=True)).to_be_visible()
   expect(page.get_by_role('heading',name='Общий салон',exact=True)).to_have_count(0)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  page.screenshot(path=f'qa-screenshots/beauty-categories-{width}.png',full_page=True)
  page.locator('.card-open').click()
  expect(page.locator('.guide-detail')).to_be_visible()
  assert page.locator('a[href^="tel:"]').count()==0
  assert page.locator('.guide-detail a[href^="https://"]').count()>0
  assert page.locator('a[href*="example-business"],a[href*="business-website"],a[href*="internal-source"]').count()==0
  expect(page.get_by_role('link',name='Маршрут в Яндекс Картах')).to_be_visible()
  expect(page.locator('.guide-detail iframe')).to_have_count(0)
  expect(page.get_by_text('Скрытое расширенное описание',exact=True)).to_have_count(0)
  expect(page.locator('#detail-about')).to_be_visible()
  expect(page.locator('#detail-about')).not_to_contain_text('Скрытое расширенное описание')
  expect(page.locator('.detail-contact-tiles').get_by_text('Тестовая улица, 1',exact=True)).to_be_visible()
  expect(page.locator('.card').get_by_text('Тестовая улица, 1',exact=True)).to_be_visible()
  assert page.locator('a[href^="tel:"]').count()==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  page.screenshot(path=f'qa-screenshots/basic-organization-{width}.png',full_page=True)
  page.get_by_role('button',name='Открыть МФЦ',exact=True).click()
  expect(page.locator('.detail-contact-tiles a[href^="tel:"]')).to_have_count(1)
  expect(page.locator('.card a[href^="tel:"]')).to_have_count(1)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  assert not errors,errors
  print('PASS',width,'uniform basic cards, private phone hidden, public institution phone visible, description and map routes, beauty aliases, city isolation, no overflow')
  context.close()
 browser.close()
