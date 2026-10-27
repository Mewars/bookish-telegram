"""Real app, mobile/desktop Chromium, public fallback catalog, no cloud APIs."""
import os
from urllib.parse import quote, urlencode, urlparse
from playwright.sync_api import sync_playwright, expect

origin = os.environ.get('NAVIGATION_TEST_ORIGIN', 'http://127.0.0.1:4175')
parsed = urlparse(origin)
assert parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1', 'localhost')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'))
    for width, height in [(390, 844), (1440, 1000)]:
        context = browser.new_context(viewport={'width': width, 'height': height})
        # Navigation must work without a cloud connection or real user account.
        context.route('**/*', lambda route: route.continue_() if urlparse(route.request.url).netloc == parsed.netloc else route.abort())
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(origin + '/#/places')
        page.wait_for_function("new URLSearchParams(location.hash.split('?')[1]).get('city')==='Енисейск'")
        page.get_by_role('button', name='Только необходимые', exact=True).click()
        search = page.get_by_role('searchbox', name='Поиск', exact=True)
        search.fill('музей')
        page.get_by_role('group', name='Категории', exact=True).get_by_role('button', name='Музеи', exact=True).click()
        page.get_by_role('group', name='Подкатегории', exact=True).get_by_role('button', name='История', exact=True).click()
        expect(page.locator('.card-open').first).to_be_visible()
        list_hash = page.evaluate('location.hash')
        list_count = page.locator('.card-open').count()
        page.locator('.card-open').first.click()
        expect(page.locator('.guide-detail')).to_be_visible()
        detail_hash = page.evaluate('location.hash')
        detail_path = detail_hash.split('?')[0]

        def restored():
            expect(search).to_have_value('музей')
            expect(page.get_by_role('group', name='Категории', exact=True).get_by_role('button', name='Музеи', exact=True)).to_have_attribute('aria-pressed', 'true')
            expect(page.get_by_role('group', name='Подкатегории', exact=True).get_by_role('button', name='История', exact=True)).to_have_attribute('aria-pressed', 'true')
            expect(page.locator('.card-open')).to_have_count(list_count)
            assert page.evaluate('location.hash') == list_hash
            expect(page.locator('.city-pill')).to_contain_text('Енисейск')

        page.go_back()
        restored()
        page.go_forward()
        expect(page.locator('.guide-detail')).to_be_visible()
        page.keyboard.press('Escape')
        restored()
        page.locator('.card-open').first.click()
        expect(page.locator('.guide-detail')).to_be_visible()
        page.get_by_role('navigation',name='Навигация страницы',exact=True).get_by_role('button',name='← Назад',exact=True).click()
        restored()
        page.reload()
        restored()

        # A city change has its own history entry, with independent filters.
        page.evaluate("location.hash='#/places?city='+encodeURIComponent('Лесосибирск')")
        expect(page.locator('.city-pill')).to_contain_text('Лесосибирск')
        expect(search).to_have_value('')
        page.go_back()
        restored()
        page.go_forward()
        expect(page.locator('.city-pill')).to_contain_text('Лесосибирск')

        # Direct link: do not use browser history (which might contain admin).
        for target in (None, '#/admin', '#/photo-admin', 'https://example.org'):
            params = {'city': 'Енисейск'}
            if target is not None:
                params['return'] = target
            page.goto(origin + '/' + detail_path + '?' + urlencode(params))
            expect(page.locator('.guide-detail')).to_be_visible()
            page.locator('.detail-breadcrumb .back-link').click()
            expect(search).to_have_value('')
            assert page.evaluate("location.hash.split('?')[0]") == '#/places'
            expect(page.locator('.app-shell')).to_have_attribute('data-section', 'places')

        # A public item under a private route prefix cannot create an admin back link.
        card_id = detail_path.rsplit('/', 1)[1]
        page.goto(origin + '/#/admin/' + quote(card_id, safe=''))
        expect(page.locator('.app-shell')).to_have_attribute('data-section', 'home')
        expect(page.locator('.guide-detail')).to_have_count(0)
        # The deployed category panel searches Home; that list must also restore.
        page.goto(origin + '/#/home?' + urlencode({'city':'Енисейск','q':'музей'}))
        expect(search).to_have_value('музей')
        page.locator('.card-open').first.click()
        expect(page.locator('.guide-detail')).to_be_visible()
        page.locator('.detail-breadcrumb .back-link').click()
        expect(search).to_have_value('музей')
        expect(page.locator('.app-shell')).to_have_attribute('data-section','home')
        assert not errors, errors
        print(f'PASS {width}px: filters/subcategory, Back/Forward, Escape, reload, cities, direct and unsafe links')
        context.close()
    browser.close()
