"""Real deployed-module UI with synthetic SDK; no hosted database writes."""
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

origin='http://127.0.0.1:4176'
sdk=Path('tests/host-classifieds-sdk.mjs').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for scenario in ['draft','rejected','published','zero']:
        context=browser.new_context(viewport={'width':390,'height':844})
        context.route('**/*',lambda route: route.continue_() if urlparse(route.request.url).netloc=='127.0.0.1:4176' else route.abort())
        context.add_init_script('window.hostInitialStatus='+repr('draft' if scenario=='zero' else scenario)+';window.hostZeroUpdate='+str(scenario=='zero').lower())
        page=context.new_page()
        page.route('**/classifieds/supabase-client.js',lambda route:route.fulfill(status=200,content_type='application/javascript',body=sdk))
        page.route('**/notifications/widget.js*',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
        page.goto(origin+'/classifieds/')
        page.get_by_role('button',name='Мои объявления',exact=True).click()
        if scenario=='published':
            page.on('dialog',lambda dialog:dialog.accept())
            page.get_by_role('button',name='Снять и изменить',exact=True).click()
        else:
            page.get_by_role('button',name='Редактировать',exact=True).click()
        expect(page.locator('select[name="city"]')).to_be_disabled()
        page.locator('input[name="title"]').fill('Исправленный тестовый стол')
        page.get_by_role('button',name='Отправить на проверку',exact=True).click()
        if scenario=='zero':
            expect(page.locator('#alert')).to_contain_text('Объявление уже отправлено')
            expect(page.locator('input[name="title"]')).to_be_visible()
        else:
            expect(page.locator('#alert')).to_contain_text('отправлено на модерацию')
            expect(page.get_by_role('heading',name='Исправленный тестовый стол',exact=True)).to_be_visible()
        calls=page.evaluate('window.hostCalls')
        assert all('city' not in call and 'author_id' not in call for call in calls)
        if scenario=='published':assert any(call.get('rpc')=='begin_classified_revision' for call in calls)
        print('PASS host editor:',scenario)
        context.close()
    browser.close()
