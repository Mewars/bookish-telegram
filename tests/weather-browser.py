"""Show the real homepage with the live cached city forecast; no user data."""
import os
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"))
    page = browser.new_page(viewport={"width": 360, "height": 740})
    page.add_init_script("localStorage.setItem('ryadom_cookie_consent_v1','necessary')")
    page.route("**/*", lambda route: route.continue_() if route.request.url.startswith("http://127.0.0.1:8188/") else route.abort())
    page.goto("http://127.0.0.1:8188/#/home")
    trigger = page.locator('.city-name-weather .city-weather-trigger')
    weather = page.get_by_role("dialog", name="Погода — Енисейск")
    expect(weather).not_to_be_visible()
    assert trigger.locator('svg').get_attribute('width') == '26'
    trigger.click()
    expect(weather.locator(".weather-current strong")).to_be_visible(timeout=20000)
    expect(weather.get_by_role("link", name="MET Norway")).to_be_visible()
    assert weather.locator(".weather-hours li").count() >= 2
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    weather.screenshot(path="weather-mobile.png")
    page.keyboard.press('Escape')
    expect(weather).not_to_be_visible()
    expect(trigger).to_be_focused()
    page.route("**/api/weather.php?**", lambda route: route.fulfill(status=503, body='{}', content_type='application/json'))
    page.reload()
    trigger.click()
    expect(weather.get_by_role("button", name="Обновить прогноз")).to_be_visible()
    expect(weather.locator(".weather-current")).to_have_count(0)
    browser.close()
print("Real city forecast renders on mobile; provider failure never displays invented weather")
