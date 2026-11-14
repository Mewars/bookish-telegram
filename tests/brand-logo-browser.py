"""Run with Vite running: python tests/brand-logo-browser.py [base URL]."""
import sys
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in (1440, 768, 390, 360, 320):
        page = browser.new_page(viewport={'width': width, 'height': 900}, is_mobile=width < 900)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + '#/home')
        page.wait_for_selector('header .scarivo-logo')
        page.locator('header .scarivo-logo img').evaluate_all(
            '(images) => Promise.all(images.map(img => img.decode()))')
        result = page.evaluate('''() => {
            const header = document.querySelector('.web-header, .app-header');
            const logo = header.querySelector('.scarivo-logo');
            const pin = logo.querySelector('.scarivo-logo__pin');
            const animation = pin.getAnimations()[0];
            if (!animation) throw Error('Missing home animation');
            animation.pause();
            const rect = el => { const r = el.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; };
            const sample = time => {
                animation.currentTime = time;
                return { pin: rect(pin), logo: rect(logo), header: rect(header),
                    letters: rect(logo.firstElementChild), city: rect(header.querySelector('.city-pill')),
                    transform: getComputedStyle(pin).transform };
            };
            return { rest: sample(0), pause: sample(3400), apex: sample(3828),
                landing: sample(4180), squash: sample(4268), end: sample(4400),
                active: [...document.querySelectorAll('.scarivo-logo__pin')].filter(el => el.getAnimations().length).length,
                footerStatic: [...document.querySelectorAll('.web-footer .scarivo-logo__pin')].every(el => !el.getAnimations().length),
                overflow: document.documentElement.scrollWidth > innerWidth };
        }''')
        assert result['active'] == 1 and result['footerStatic'], (width, result)
        assert abs(result['apex']['pin'][1] - result['rest']['pin'][1] + 7) < .05, (width, result)
        for phase in ('pause', 'apex', 'landing', 'squash', 'end'):
            for fixed in ('logo', 'header', 'letters', 'city'):
                assert result[phase][fixed] == result['rest'][fixed], (width, phase, fixed, result)
        assert result['pause']['transform'] == result['rest']['transform']
        assert abs(result['landing']['pin'][1] - result['rest']['pin'][1]) < .05
        assert result['squash']['pin'][3] < result['rest']['pin'][3]
        assert not result['overflow'], width
        page.emulate_media(reduced_motion='reduce')
        assert page.locator('header .scarivo-logo__pin').evaluate(
            "el => getComputedStyle(el).animationName === 'none' && getComputedStyle(el).transform === 'none'")
        page.emulate_media(reduced_motion='no-preference')
        for route in ('places', 'events', 'services', 'profile', 'login', 'admin', 'admin-preview', 'add-organization'):
            page.evaluate('(route) => location.hash = "/" + route', route)
            page.wait_for_selector(f'.app-shell[data-section="{route}"]')
            assert page.locator('.scarivo-logo--animated').count() == 0, (width, route)
            assert page.locator('.scarivo-logo__pin').evaluate_all(
                "els => els.every(el => getComputedStyle(el).animationName === 'none' && getComputedStyle(el).transform === 'none')"), (width, route)
        page.evaluate('location.hash = "/home"')
        page.wait_for_selector('header .scarivo-logo--animated')
        assert not errors, (width, errors)
        page.screenshot(path=f'work/scarivo-{width}.png')
        print(f'{width}px: home jump/pause/squash, stable layout, static footer + 9 internal routes, reduced motion, return home: OK')
        page.close()
    browser.close()
