"""Real Auth/API/browser friends flow. Synthetic identities and GPS only, no cloud writes."""

import argparse
import json
import os
from pathlib import Path
import re
import sys
import traceback
import urllib.error
import urllib.parse
import urllib.request
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument("--workdir", type=Path, required=True)
args = parser.parse_args()
cfg = json.loads((args.workdir / "credentials.json").read_text())
origin = "http://127.0.0.1:4180"
host_mode = os.environ.get("FRIENDS_HOST_E2E") == "1"
tokens = {}
results = []


def redact(kind, error, tb):
    detail = "".join(traceback.format_exception(kind, error, tb))
    for secret in [
        cfg["jwt_secret"],
        cfg["db_password"],
        cfg["anon_key"],
        cfg["service_key"],
        *tokens.values(),
        *(u["password"] for u in cfg["users"].values()),
    ]:
        detail = detail.replace(secret, "[redacted]")
    detail = re.sub(
        r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[redacted JWT]", detail
    )
    sys.stderr.write(detail)


sys.excepthook = redact


def api(role, name, data=None):
    req = urllib.request.Request(
        origin + ("/api/friends.php" if host_mode else "/rest/v1/rpc/" + name),
        data=json.dumps(
            {
                "name": name,
                "params": (
                    {**(data or {}), "p_consent_version": "FRIENDS-GEO-1.0"}
                    if name == "nearby_start_sharing"
                    else data or {}
                ),
            }
            if host_mode
            else data or {}
        ).encode(),
        method="POST",
        headers={
            "Authorization": "Bearer " + tokens.get(role, cfg["anon_key"]),
            "apikey": cfg["anon_key"],
            "Content-Type": "application/json",
        },
    )
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read()
    body = json.loads(raw) if raw else None
    if host_mode and body is not None:
        body = body.get("error") if response.status >= 400 else body.get("data")
    return response.status, body


def passed(description):
    results.append(description)
    print("PASS: " + description, flush=True)


for role, user in cfg["users"].items():
    req = urllib.request.Request(
        origin + "/auth/v1/token?grant_type=password",
        data=json.dumps(
            {"email": user["email"], "password": user["password"]}
        ).encode(),
        headers={"apikey": cfg["anon_key"], "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        tokens[role] = json.load(response)["access_token"]
status, denied = api(None, "nearby_state")
assert status == 401 and denied["code"] in ("42501", "unauthorized")
passed("anonymous access to private friends API is denied")

if host_mode:
    original = tokens["outsider"]
    parts = original.split(".")
    parts[2] = ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
    tokens["outsider"] = ".".join(parts)
    assert api("outsider", "nearby_state")[0] == 401
    tokens["outsider"] = original
    for method, headers, body, expected in [
        ("GET", {}, None, 405),
        ("POST", {"Content-Type": "text/plain"}, b"{}", 415),
        (
            "POST",
            {"Content-Type": "application/json", "Origin": "https://untrusted.example"},
            b'{"name":"nearby_state"}',
            403,
        ),
        ("POST", {"Content-Type": "application/json"}, b" " * 8193, 413),
    ]:
        req = urllib.request.Request(
            origin + "/api/friends.php",
            method=method,
            data=body,
            headers={"Authorization": "Bearer " + original, **headers},
        )
        try:
            response = urllib.request.urlopen(req, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        assert (
            response.status == expected
            and response.headers.get("Cache-Control") == "no-store"
        )
    passed(
        "host gateway rejects forged identity, cross-origin requests, wrong methods/types and oversized bodies"
    )

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
    )
    contexts = []
    script_dialogs = []
    tile_requests = []
    allow_tiles = os.environ.get("ALLOW_PUBLIC_MAP_TILES") == "1"

    def route_request(route):
        url = urllib.parse.urlsplit(route.request.url)
        if url.netloc == "djqhixvlfsbvannoqdjw.supabase.co":
            response = route.fetch(
                url=origin + url.path + ("?" + url.query if url.query else "")
            )
            route.fulfill(response=response)
        elif url.netloc == "127.0.0.1:4180":
            route.continue_()
        elif url.netloc == "tile.openstreetmap.org":
            tile_requests.append(route.request.url)
            route.continue_() if allow_tiles else route.abort()
        else:
            route.abort()

    def login(role, coords):
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            geolocation=coords,
            permissions=["geolocation"],
        )
        contexts.append(ctx)
        ctx.route("**/*", route_request)
        ctx.add_init_script(
            """localStorage.setItem('ryadom_cookie_consent_v1','necessary');
          window.__gpsCalls=0; const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
          navigator.geolocation.getCurrentPosition=(...args)=>{window.__gpsCalls++;return original(...args)};"""
        )
        page = ctx.new_page()

        def on_dialog(dialog):
            if (
                host_mode
                and dialog.type == "confirm"
                and dialog.message
                == "Удалить все ваши данные раздела «Друзья рядом»? Друзей потребуется добавить заново."
            ):
                dialog.accept()
            else:
                script_dialogs.append(dialog.type)
                dialog.dismiss()

        page.on("dialog", on_dialog)
        page.goto(origin + "/#/login")
        page.get_by_label("Электронная почта").fill(cfg["users"][role]["email"])
        page.get_by_label("Пароль", exact=True).fill(cfg["users"][role]["password"])
        page.get_by_role("button", name="Войти по почте").click()
        page.wait_for_url("**/#/profile")
        page.goto(origin + "/#/friends")
        expect(page.get_by_text("Вы невидимы", exact=True)).to_be_visible()
        assert page.evaluate("window.__gpsCalls") == 0
        return page

    alice = login("seller", {"latitude": 58.455678, "longitude": 92.176543})
    bob = login("buyer", {"latitude": 58.449123, "longitude": 92.165678})
    assert not tile_requests
    passed(
        "opening friends/map makes no GPS call and sends no third-party map requests"
    )
    alice.get_by_label("Как вас увидят друзья").fill("Анна · демонстрация")
    alice.get_by_role("button", name="Создать личный код").click()
    expect(alice.get_by_label("Ваш код друга", exact=True)).to_have_value(
        re.compile(r"^[a-f0-9]{32}$")
    )
    code = alice.get_by_label("Ваш код друга", exact=True).input_value()
    bob.get_by_label("Как вас увидят друзья").fill("Михаил · демонстрация")
    bob.get_by_label("Код от друга", exact=True).fill(code)
    bob.get_by_role("button", name="Отправить заявку").click()
    expect(bob.get_by_text("Ожидает подтверждения", exact=True)).to_be_visible()
    status, pending = api("buyer", "nearby_state")
    assert (
        status == 200
        and pending["friends"][0]["accepted"] is False
        and pending["friends"][0]["latitude"] is None
    )
    status, denied = api(
        "buyer",
        "nearby_respond",
        {"p_peer": cfg["users"]["seller"]["id"], "p_accept": True},
    )
    assert (
        status == 403
        and denied["code"] == "42501"
        and (host_mode or "Request unavailable" in denied["message"])
    )
    alice.get_by_role("button", name="Обновить", exact=True).click()
    incoming = alice.locator("article").filter(
        has=alice.get_by_role("heading", name="Михаил · демонстрация", exact=True)
    )
    incoming.get_by_role("button", name="Принять", exact=True).click()
    expect(alice.get_by_role("heading", name="Мои друзья · 1")).to_be_visible()
    bob.get_by_role("button", name="Обновить", exact=True).click()
    expect(bob.get_by_role("heading", name="Мои друзья · 1")).to_be_visible()
    passed(
        "a personal invitation needs recipient approval; requester cannot self-accept"
    )
    alice.get_by_role("button", name="Показать друзьям на один час", exact=True).click()
    expect(alice.locator(".friends-status")).to_contain_text("Вас видно до")
    assert alice.evaluate("window.__gpsCalls") == 1
    status, own = api("seller", "nearby_state")
    assert own["self"]["latitude"] == 58.46 and own["self"]["longitude"] == 92.18
    status, visible = api("buyer", "nearby_state")
    assert (
        visible["friends"][0]["latitude"] == 58.46
        and visible["friends"][0]["longitude"] == 92.18
    )
    for role in ["outsider", "editor", "foreign_editor"]:
        status, hidden = api(role, "nearby_state")
        assert (
            status == 200
            and hidden["friends"] == []
            and hidden["self"]["latitude"] is None
        )
    bob.get_by_role("button", name="Обновить", exact=True).click()
    expect(
        bob.locator(".leaflet-tooltip").filter(has_text="Анна · демонстрация")
    ).to_be_visible()
    passed(
        "only accepted friend sees the rounded point; outsiders and both city moderators see nothing"
    )
    bob.get_by_role("button", name="Показать друзьям на один час", exact=True).click()
    expect(bob.locator(".friends-status")).to_contain_text("Вас видно до")
    # An explicit click may request public map tiles, never before consent.
    assert not tile_requests
    bob.get_by_role("button", name="Загрузить карту OpenStreetMap", exact=True).click()
    if allow_tiles:
        try:
            bob.wait_for_function(
                "Array.from(document.querySelectorAll('.leaflet-tile')).some(image=>image.complete&&image.naturalWidth>0)",
                timeout=10000,
            )
        except Exception:
            print(
                "NOTE: public map tiles unavailable; point/privacy checks remain valid",
                flush=True,
            )
    else:
        expect(
            bob.get_by_text("Не удалось загрузить часть карты.", exact=False)
        ).to_be_visible()
    bob.get_by_role("region", name="Карта друзей").screenshot(
        path=str(
            args.workdir / ("friends-host-map.png" if host_mode else "friends-map.png")
        )
    )
    assert tile_requests
    assert all(
        re.match(r"^https://tile\.openstreetmap\.org/\d+/\d+/\d+\.png$", url)
        for url in tile_requests
    )
    assert bob.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1")
    passed(
        "map layers load only after explicit consent; names/individual point coordinates are not in tile URLs"
    )
    alice.get_by_role("button", name="Стать невидимым", exact=True).click()
    expect(alice.get_by_text("Вы невидимы", exact=True)).to_be_visible()
    bob.get_by_role("button", name="Обновить", exact=True).click()
    expect(
        bob.locator(".leaflet-tooltip").filter(has_text="Анна · демонстрация")
    ).to_have_count(0)
    status, hidden = api("buyer", "nearby_state")
    assert hidden["friends"][0]["latitude"] is None
    status, token = api("seller", "nearby_start_sharing")
    assert status == 200
    assert api("seller", "nearby_hide")[0] in (200, 204)
    status, denied = api(
        "seller", "nearby_share", {"p_lat": 58.45, "p_lon": 92.17, "p_token": token}
    )
    assert (
        status == 403
        and denied["code"] == "42501"
        and (host_mode or "Sharing consent expired" in denied["message"])
    )
    passed(
        "hiding removes access immediately and a late/replayed GPS upload cannot restore it"
    )
    alice.evaluate(
        """()=>{const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition=(ok,fail,options)=>{window.__pendingGeo=()=>original(position=>{ok(position);window.__geoReleased=true},fail,options)};}"""
    )
    alice.get_by_role("button", name="Показать друзьям на один час", exact=True).click()
    alice.wait_for_function('typeof window.__pendingGeo === "function"')
    alice.get_by_role("button", name="Отменить и стать невидимым", exact=True).click()
    expect(
        alice.get_by_text(
            "Вы невидимы. Публикация местоположения отключена.", exact=True
        )
    ).to_be_visible()
    alice.evaluate("window.__pendingGeo()")
    alice.wait_for_function("window.__geoReleased===true")
    assert api("seller", "nearby_state")[1]["self"]["latitude"] is None
    passed("cancelling the browser GPS prompt ignores a delayed successful position")
    unsafe_name = "<img src=x onerror=alert(1)>"
    assert api("buyer", "nearby_invite", {"p_name": unsafe_name})[0] == 200
    alice.get_by_role("button", name="Обновить", exact=True).click()
    expect(alice.get_by_role("heading", name=unsafe_name, exact=True)).to_be_visible()
    expect(
        alice.locator(".leaflet-tooltip").filter(has_text=unsafe_name)
    ).to_be_visible()
    assert alice.locator(".leaflet-tooltip img").count() == 0 and not script_dialogs
    passed("friend nicknames remain harmless text in both list and map tooltip")
    status, bob_code = api(
        "buyer", "nearby_invite", {"p_name": "Михаил · демонстрация"}
    )
    assert status == 200
    friend = bob.locator("article").filter(
        has=bob.get_by_role("heading", name="Анна · демонстрация", exact=True)
    )
    friend.get_by_role("button", name="Заблокировать", exact=True).click()
    expect(
        bob.get_by_role("heading", name="Заблокированные", exact=True)
    ).to_be_visible()
    assert api("seller", "nearby_state")[1]["friends"] == []
    alice.get_by_role("button", name="Обновить", exact=True).click()
    expect(alice.get_by_role("heading", name="Мои друзья · 0")).to_be_visible()
    expect(alice.locator(".leaflet-tooltip")).to_have_count(0)
    status, denied = api(
        "seller",
        "nearby_request",
        {"p_code": bob_code, "p_name": "Анна · демонстрация"},
    )
    assert status == 403 and denied["code"] == "42501"
    passed("blocking removes the relationship and all location access")
    if host_mode:
        assert api("seller", "nearby_forget")[0] == 200
        assert (
            api("seller", "nearby_invite", {"p_name": "Анна · демонстрация"})[0] == 200
        )
        assert (
            api(
                "seller",
                "nearby_request",
                {"p_code": bob_code, "p_name": "Анна · демонстрация"},
            )[0]
            == 403
        )
        assert len(api("buyer", "nearby_state")[1]["blocked"]) == 1
        passed("forgetting and recreating a profile cannot bypass another user block")
        bob.get_by_role("button", name="Удалить данные раздела", exact=True).click()
        expect(
            bob.get_by_text("Данные раздела удалены. Вы невидимы.", exact=True)
        ).to_be_visible()
        own = api("buyer", "nearby_state")[1]
        assert (
            own["self"]["latitude"] is None
            and own["self"]["invite_code"] is None
            and own["friends"] == []
            and own["blocked"] == []
        )
        expect(bob.locator(".leaflet-tooltip")).to_have_count(0)
        passed(
            "deleting section data clears the point, invitations, friendships and blocks without deleting the site account"
        )
    assert not script_dialogs
    for context in contexts:
        context.set_offline(True)
        context.unroute_all(behavior="wait")
        context.close()
    browser.close()
(
    args.workdir / ("friends-host-report.json" if host_mode else "friends-report.json")
).write_text(
    json.dumps(
        {
            "scope": "local synthetic multi-user friends/GPS E2E; no cloud writes",
            "passed": results,
        },
        ensure_ascii=False,
        indent=2,
    )
)
print(str(len(results)) + " friends privacy/browser E2E stages passed")
