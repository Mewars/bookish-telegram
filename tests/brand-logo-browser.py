"""Run with Vite running: python tests/brand-logo-browser.py [base URL]."""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/'
Path('work').mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'), args=['--no-sandbox'])
    for width in (1440, 768, 390, 360, 320):
        page = browser.new_page(viewport={'width': width, 'height': 900}, is_mobile=width < 900)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + '#/home')
        page.wait_for_selector('header .scarivo-logo')
        page.locator('header .scarivo-logo img').evaluate_all(
            '(images) => Promise.all(images.map(img => img.decode()))')
        page.locator('header .scarivo-logo--loading').wait_for(state='detached')
        result = page.evaluate('''() => {
            const header = document.querySelector('.web-header, .app-header');
            const logo = header.querySelector('.scarivo-logo');
            const pin = logo.querySelector('.scarivo-logo__pin');
            const marker = pin.querySelector('img');
            const arrival = pin.getAnimations().find(a => a.animationName === 'vstrechay-pin-arrive');
            const hop = marker.getAnimations().find(a => a.animationName === 'vstrechay-pin-hop');
            if (!arrival || !hop) throw Error('Home needs independent arrival and recurring hop animations');
            arrival.pause();
            hop.pause();
            const rect = el => { const r = el.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; };
            const sample = () => ({
                pin: rect(pin), marker: rect(marker), logo: rect(logo), header: rect(header),
                letters: rect(logo.firstElementChild), city: rect(header.querySelector('.city-pill'))
            });
            const sampleArrival = time => { arrival.currentTime = time; return sample(); };
            const start = sampleArrival(0);
            const arc = sampleArrival(150);
            const restArrival = sampleArrival(650);
            const squash = sampleArrival(737.5);
            const bounce = sampleArrival(875);
            const end = sampleArrival(1250);
            const stopped = sampleArrival(9000);
            const sampleHop = time => {
                arrival.currentTime = 1250; // arrival has finished; isolate the later hop
                hop.currentTime = time;
                return sample();
            };
            // Web Animations time includes the one-time 1.25s delay.
            const firstRest = sampleHop(1250 + 5000);
            const beforeHop = sampleHop(1250 + .80 * 12500);
            const apex = sampleHop(1250 + .87 * 12500);
            const landing = sampleHop(1250 + .91 * 12500);
            const rebound = sampleHop(1250 + .93 * 12500);
            const settled = sampleHop(1250 + .99 * 12500);
            const nextApex = sampleHop(1250 + 1.87 * 12500);
            const timing = hop.effect.getTiming();
            return {
                start, arc, restArrival, squash, bounce, end, stopped,
                firstRest, beforeHop, apex, landing, rebound, settled, nextApex,
                iterations: arrival.effect.getTiming().iterations,
                arrivalDuration: arrival.effect.getTiming().duration,
                hopDuration: timing.duration, hopDelay: timing.delay,
                hopInfinite: !Number.isFinite(timing.iterations),
                active: [...document.querySelectorAll('.scarivo-logo__pin')]
                    .filter(el => el.getAnimations().length).length,
                periodicActive: [...document.querySelectorAll('.scarivo-logo__pin > img')]
                    .filter(el => el.getAnimations().length).length,
                footerStatic: [...document.querySelectorAll('.web-footer .scarivo-logo__pin')].every(el =>
                    !el.getAnimations().length && !el.querySelector('img')?.getAnimations().length),
                overflow: document.documentElement.scrollWidth > innerWidth
            };
        }''')
        assert result['active'] == 1 and result['periodicActive'] == 1 and result['footerStatic'], (width, result)
        assert result['iterations'] == 1 and result['arrivalDuration'] == 1250
        assert result['hopDuration'] == 12500 and result['hopDelay'] == 1250
        assert result['hopInfinite'], (width, result)
        assert result['start']['pin'][0] < result['restArrival']['pin'][0]
        assert result['arc']['pin'][1] < result['restArrival']['pin'][1]
        assert result['bounce']['pin'][1] < result['restArrival']['pin'][1]
        assert result['end']['pin'] == result['stopped']['pin']
        assert result['squash']['pin'][3] < result['restArrival']['pin'][3]
        # Initially stationary, then a visible natural hop, a soft compressed landing
        # and a smaller rebound. The same jump repeats 12.5s later.
        assert result['beforeHop']['marker'] == result['firstRest']['marker'], (width, 'premature hop')
        assert result['apex']['marker'][1] < result['firstRest']['marker'][1] - 4, (width, 'no visible rise')
        assert result['landing']['marker'][3] < result['firstRest']['marker'][3], (width, 'no landing squash')
        assert result['rebound']['marker'][1] < result['firstRest']['marker'][1], (width, 'no rebound')
        assert result['settled']['marker'] == result['firstRest']['marker'], (width, 'did not settle')
        assert abs(result['apex']['marker'][1] - result['nextApex']['marker'][1]) < .5, (width, 'hop did not repeat')
        for phase in ('start', 'arc', 'squash', 'bounce', 'end', 'stopped'):
            for fixed in ('logo', 'header', 'letters', 'city'):
                assert result[phase][fixed] == result['restArrival'][fixed], (width, phase, fixed, result)
        for phase in ('firstRest', 'beforeHop', 'apex', 'landing', 'rebound', 'settled', 'nextApex'):
            for fixed in ('logo', 'header', 'letters', 'city', 'pin'):
                assert result[phase][fixed] == result['firstRest'][fixed], (width, phase, fixed, result)
        assert not result['overflow'], width
        page.emulate_media(reduced_motion='reduce')
        assert page.locator('header .scarivo-logo__pin').evaluate(
            "el => getComputedStyle(el).animationName === 'none' && getComputedStyle(el).transform === 'none' && getComputedStyle(el.querySelector('img')).animationName === 'none' && getComputedStyle(el.querySelector('img')).transform === 'none'")
        page.emulate_media(reduced_motion='no-preference')
        for route in ('places', 'events', 'services', 'profile', 'login', 'admin', 'admin-preview', 'add-organization'):
            page.evaluate('(route) => location.hash = "/" + route', route)
            page.wait_for_selector(f'.app-shell[data-section="{route}"]')
            assert page.locator('.scarivo-logo--animated').count() == 0, (width, route)
            assert page.locator('.scarivo-logo__pin').evaluate_all(
                "els => els.every(el => getComputedStyle(el).animationName === 'none' && getComputedStyle(el).transform === 'none' && getComputedStyle(el.querySelector('img')).animationName === 'none' && getComputedStyle(el.querySelector('img')).transform === 'none')"), (width, route)
        page.evaluate('location.hash = "/home"')
        page.wait_for_selector('header .scarivo-logo--animated')
        assert not errors, (width, errors)
        # Capture predictable, inspectable states rather than whichever frame
        # happens to render immediately after returning to the homepage.
        page.locator('header .scarivo-logo--loading').wait_for(state='detached')
        page.locator('header .scarivo-logo__pin').evaluate("""el => {
            const arrival = el.getAnimations().find(a => a.animationName === 'vstrechay-pin-arrive');
            const hop = el.querySelector('img').getAnimations().find(a => a.animationName === 'vstrechay-pin-hop');
            if (!arrival || !hop) throw Error('Missing motion on returning home');
            arrival.pause();
            arrival.currentTime = 1250;
            hop.pause();
            hop.currentTime = 1250 + 5000;
        }""")
        page.screenshot(path=f'work/scarivo-{width}.png')
        page.locator('header .scarivo-logo__pin > img').evaluate("""el => {
            const hop = el.getAnimations().find(a => a.animationName === 'vstrechay-pin-hop');
            hop.currentTime = 1250 + .87 * 12500;
        }""")
        page.screenshot(path=f'work/scarivo-{width}-hop.png')
        print(f'{width}px: one-time entrance + repeated 12.5s hop, stable letters/header, static internal pages/footer, reduced motion: OK')
        page.close()
    # Cold-load regression: keep the wordmark pending until after the header renders.
    page = browser.new_page(viewport={'width': 390, 'height': 900})
    pending = []
    page.route('**/brand/vstrechay-wordmark*.webp*', lambda route: pending.append(route))
    page.goto(base + '?brand-cold-load=1#/home', wait_until='domcontentloaded')
    page.wait_for_selector('header .scarivo-logo--loading')
    assert page.locator('header .scarivo-logo__pin').evaluate(
        "el => getComputedStyle(el).animationPlayState === 'paused' && getComputedStyle(el).opacity === '0' && getComputedStyle(el.querySelector('img')).animationPlayState === 'paused'")
    for route in pending:
        route.continue_()
    page.locator('header .scarivo-logo--loading').wait_for(state='detached')
    assert page.locator('header .scarivo-logo__pin').evaluate(
        "el => getComputedStyle(el).animationPlayState === 'running' && getComputedStyle(el.querySelector('img')).animationPlayState === 'running'")
    print('Cold load: arrival waits for artwork decoding: OK')
    page.close()
    browser.close()
