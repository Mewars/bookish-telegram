"""Real compiled app, synthetic SDK spy: private route never starts Webvisor."""

from pathlib import Path
import mimetypes
import os
from urllib.parse import urlsplit, unquote
from playwright.sync_api import sync_playwright, expect

root = (Path(__file__).resolve().parents[1] / "dist").resolve()
sdk_requests = []
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
    )
    context = browser.new_context(viewport={"width": 390, "height": 844})
    context.add_init_script(
        "localStorage.setItem('ryadom_cookie_consent_v1','accepted');window.__ymCalls=[]"
    )

    def route_request(route):
        parsed = urlsplit(route.request.url)
        if route.request.url == "https://mc.yandex.ru/metrika/tag.js":
            sdk_requests.append(route.request.url)
            route.fulfill(
                content_type="application/javascript",
                body="const queue=window.ym?.a??[];window.__ymCalls.push(...queue);window.ym=(...args)=>window.__ymCalls.push(args)",
            )
        elif parsed.netloc == "ryadomcity.ru":
            if parsed.path.startswith("/api/"):
                route.fulfill(status=503, content_type="application/json", body="{}")
                return
            path = (root / unquote(parsed.path).lstrip("/")).resolve()
            if path == root:
                path = root / "index.html"
            if path.is_relative_to(root) and path.is_file():
                route.fulfill(
                    path=str(path),
                    content_type=mimetypes.guess_type(path)[0]
                    or "application/octet-stream",
                )
            else:
                route.fulfill(status=404, body="")
        else:
            route.abort()

    context.route("**/*", route_request)
    page = context.new_page()
    page.goto("https://ryadomcity.ru/#/friends")
    expect(page.get_by_role("heading", name="Друзья рядом", exact=True)).to_be_visible()
    page.wait_for_timeout(200)
    assert sdk_requests == [] and page.evaluate("window.__ymCalls.length") == 0
    assert "ym-disable-webvisor" in page.locator(".friends-page").get_attribute("class")
    page.goto("https://ryadomcity.ru/#/home")
    page.wait_for_function("window.__ymCalls.some(call=>call[1]==='init')")
    assert len(sdk_requests) == 1
    page.get_by_role("button", name="Друзья рядом — узнать о разделе").click()
    intro = page.get_by_role("dialog", name="Друзья рядом")
    expect(intro).to_be_visible()
    # The explanatory card does not request GPS or enter the private route.
    assert not page.evaluate("window.__ymCalls.some(call=>call[1]==='destruct')")
    intro.get_by_role("button", name="Открыть друзей").click()
    expect(page.get_by_role("heading", name="Друзья рядом", exact=True)).to_be_visible()
    page.wait_for_function("window.__ymCalls.some(call=>call[1]==='destruct')")
    calls = page.evaluate("window.__ymCalls")
    assert calls[-1][1] == "destruct"
    assert not any(call[1] == "hit" and "friends" in str(call[2:]) for call in calls)
    assert (
        page.locator('script[src="https://mc.yandex.ru/metrika/tag.js"]').count() == 0
    )
    browser.close()
print(
    "PASS: consented analytics never starts on direct friends entry and stops before private navigation"
)
