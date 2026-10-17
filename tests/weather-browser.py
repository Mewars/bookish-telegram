"""Show the real homepage with the live cached city forecast; no user data."""
import os
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"))
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.add_init_script("localStorage.setItem('ryadom_cookie_consent_v1','necessary')")
    page.route("**/*", lambda route: route.continue_() if route.request.url.startswith("http://127.0.0.1:8188/") else route.abort())
    page.goto("http://127.0.0.1:8188/#/home")
    weather = page.get_by_role("region", name="Погода — Енисейск")
    expect(weather.locator(".weather-current strong")).to_be_visible(timeout=20000)
    expect(weather.get_by_role("link", name="MET Norway")).to_be_visible()
    weather.locator("summary").evaluate("element => element.scrollIntoView({block: 'center', behavior: 'instant'})")
    weather.locator("summary").click()
    assert weather.locator(".weather-hours li").count() >= 2
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    weather.screenshot(path="weather-mobile.png")
    page.route("**/api/weather.php?**", lambda route: route.fulfill(status=503, body='{}', content_type='application/json'))
    page.reload()
    expect(weather.get_by_role("button", name="Обновить прогноз")).to_be_visible()
    expect(weather.locator(".weather-current")).to_have_count(0)
    browser.close()
print("Real city forecast renders on mobile; provider failure never displays invented weather")
