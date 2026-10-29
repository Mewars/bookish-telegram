"""Radio is an external navigation; visiting Ryadom never starts a radio request."""
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ORIGIN = 'http://127.0.0.1:4177'
RADIO = 'https://www.radiorecord.ru/'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'))
    for width in (360, 390, 1440):
        context = browser.new_context(viewport={'width': width, 'height': 900})
        radio_requests = []
        def route(request):
            url = request.request.url
            host = urlparse(url).hostname or ''
            if 'radiorecord' in host or 'hostingradio' in host:
                radio_requests.append(url)
                request.fulfill(status=200, content_type='text/html', body='<title>Official station fixture</title>')
            elif urlparse(url).path in ('/wall/', '/classifieds/'):
                request.fulfill(status=200, content_type='text/html', body='<h1>Раздел города</h1><a href="/#/home">Главная</a><a href="/classifieds/">Объявления</a>')
            elif url.startswith(ORIGIN + '/'):
                request.continue_()
            else:
                request.abort()
        context.route('**/*', route)
        page = context.new_page()
        page.add_init_script("window.__radioAudioCount=0;window.Audio=class{constructor(){window.__radioAudioCount++;throw Error('Embedded radio must not be created')}}")
        page.goto(ORIGIN + '/#/home')
        page.locator('.city-home').wait_for()
        cookies = page.get_by_role('button', name='Только необходимые', exact=True)
        if cookies.is_visible():
            cookies.click()
        radio = page.get_by_role('link', name='Радио — официальный сайт Radio Record, откроется в новой вкладке', exact=True)
        expect(radio).to_be_visible()
        expect(radio).to_have_attribute('href', RADIO)
        expect(radio).to_have_attribute('rel', 'noopener noreferrer')
        assert not radio_requests
        assert page.evaluate('window.__radioAudioCount') == 0
        expect(page.locator('#music-player')).to_have_count(0)
        # Keyboard navigation opens the real external-link behavior into a controlled fixture.
        radio.focus()
        with page.expect_popup() as popup_info:
            radio.press('Enter')
        popup = popup_info.value
        popup.wait_for_load_state()
        assert popup.url == RADIO
        assert popup.evaluate('window.opener === null')
        popup.close()
        assert radio_requests == [RADIO], radio_requests
        page.get_by_role('button', name='Места', exact=True).click()
        expect(page.locator('.app-shell')).to_have_attribute('data-section', 'places')
        page.add_script_tag(path='host-public/ui/site-shell.js')
        page.evaluate("window.ryadomOpenSection('/wall/')")
        dialog = page.get_by_role('dialog', name='Городской раздел РЯДОМ')
        expect(dialog).to_be_visible()
        page.frame_locator('.ryadom-shell-iframe').get_by_role('link', name='Объявления', exact=True).click()
        expect(page.locator('.ryadom-shell-iframe')).to_have_attribute('src', '/classifieds/?ryadom_embed=1')
        page.frame_locator('.ryadom-shell-iframe').get_by_role('link', name='Главная', exact=True).click()
        expect(dialog).to_have_count(0)
        assert page.evaluate('window.__radioAudioCount') == 0
        assert radio_requests == [RADIO]
        print('PASS', width, 'external radio only; no autoplay/stream; keyboard/popup isolation; public section navigation')
        context.close()
    browser.close()
