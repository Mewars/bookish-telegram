"""Real React/Chromium gallery regression; Storage calls use an explicit fixture."""
import os
from playwright.sync_api import sync_playwright, expect

origin = os.environ.get('GALLERY_TEST_ORIGIN', 'http://127.0.0.1:4179')

def opened(browser):
    page = browser.new_page(viewport={'width':390,'height':844})
    page.clock.install()
    page.goto(origin + '/tests/browser-gallery/index.html')
    expect(page.get_by_role('img', name='Фото объявления', exact=False)).to_be_visible()
    return page

with sync_playwright() as p:
    executable = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
    browser = p.chromium.launch(headless=True, executable_path=executable)
    results = []

    page = opened(browser)
    page.get_by_role('button', name='Следующее фото').click()
    expect(page.get_by_role('button', name='Фото 2', exact=True)).to_have_attribute('aria-pressed','true')
    first_url = page.get_by_role('img', name='Фото объявления', exact=False).get_attribute('src')
    page.clock.fast_forward(539000)
    assert page.evaluate('window.galleryTest.loads') == 1
    page.clock.fast_forward(2000)
    expect(page.get_by_role('img', name='Фото объявления', exact=False)).not_to_have_attribute('src', first_url)
    expect(page.get_by_role('button', name='Фото 2', exact=True)).to_have_attribute('aria-pressed','true')
    page.clock.fast_forward(541000)
    expect(page.get_by_role('img', name='Фото объявления', exact=False)).to_have_attribute('src','/test-images/3/1.svg')
    results.append('repeated renewal before expiry preserves the selected photo')
    page.close()

    page = opened(browser)
    page.evaluate("window.galleryHidden=true; Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.galleryHidden?'hidden':'visible'})")
    page.clock.fast_forward(700000)
    assert page.evaluate('window.galleryTest.loads') == 1
    page.evaluate("window.galleryHidden=false;document.dispatchEvent(new Event('visibilitychange'))")
    expect(page.get_by_role('img', name='Фото объявления', exact=False)).to_have_attribute('src','/test-images/2/0.svg')
    results.append('returning to a hidden tab renews overdue URLs')
    page.close()

    page = opened(browser)
    page.evaluate("window.galleryHidden=true; Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.galleryHidden?'hidden':'visible'})")
    page.clock.fast_forward(700000)
    page.evaluate("window.galleryHidden=false;window.dispatchEvent(new Event('focus'))")
    expect(page.get_by_role('img', name='Фото объявления', exact=False)).to_have_attribute('src','/test-images/2/0.svg')
    results.append('focus refreshes overdue URLs even when the background timer was delayed')
    page.close()

    page = browser.new_page(viewport={'width':390,'height':844})
    page.clock.install()
    page.add_init_script('window.galleryInitialEmpty=true')
    page.goto(origin + '/tests/browser-gallery/index.html')
    expect(page.get_by_text('Снимков: 0 из 10')).to_be_visible()
    page.clock.fast_forward(1200000)
    assert page.evaluate('window.galleryTest.loads') == 1
    results.append('empty albums do not schedule signing requests')
    page.close()

    page = opened(browser)
    page.evaluate('window.galleryTest.fail=true')
    page.clock.fast_forward(541000)
    expect(page.get_by_role('alert')).to_contain_text('Synthetic signing outage')
    expect(page.get_by_role('button',name='Удалить выбранное фото')).to_have_count(0)
    attempts = page.evaluate('window.galleryTest.loads')
    page.clock.fast_forward(1200000)
    assert page.evaluate('window.galleryTest.loads') == attempts
    page.evaluate('window.galleryTest.fail=false')
    page.get_by_role('button',name='Повторить загрузку фотографий').click()
    expect(page.get_by_role('img',name='Фото объявления',exact=False)).to_be_visible()
    results.append('renewal failure stops retries, hides editing and recovers on explicit retry')
    page.close()

    for selector in ['.classified-gallery-main img','.classified-gallery-thumbs img']:
        page = opened(browser)
        page.locator(selector).first.evaluate("image=>image.dispatchEvent(new Event('error'))")
        expect(page.get_by_role('alert')).to_contain_text('Не удалось показать фотографию')
        page.get_by_role('button',name='Повторить загрузку фотографий').click()
        expect(page.get_by_role('img',name='Фото объявления',exact=False)).to_be_visible()
        results.append('image-error recovery: '+selector)
        page.close()

    page = opened(browser)
    before=page.evaluate('window.galleryTest.loads')
    page.evaluate("document.dispatchEvent(new Event('gallery-test-unmount'))")
    page.clock.fast_forward(700000)
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'))")
    assert page.evaluate('window.galleryTest.loads') == before
    results.append('unmount removes timers and visibility/focus listeners')
    page.close()

    browser.close()
    for result in results:
        print('PASS: '+result)
    print(f'{len(results)} browser scenarios passed; mocked Storage, not live Supabase E2E')
