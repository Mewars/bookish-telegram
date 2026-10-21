"""Real local browser/Auth/PostgREST/Storage E2E using synthetic accounts.

All remote requests are aborted except the virtual Ryadom-Test API origin,
which is fulfilled from 127.0.0.1. There is no cloud write mode.
"""

import json, struct, time, uuid, urllib.request, urllib.error, urllib.parse, zlib
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import argparse, os, re, sys, traceback

parser = argparse.ArgumentParser()
parser.add_argument("--workdir", required=True, type=Path)
args = parser.parse_args()
cfg = json.loads((args.workdir / "credentials.json").read_text())


# Keep failure logs free of generated passwords/JWTs, including Playwright logs.
def sanitized_exception(kind, error, tb):
    text = "".join(traceback.format_exception(kind, error, tb))
    values = [
        cfg["jwt_secret"],
        cfg["db_password"],
        cfg["service_key"],
        cfg["anon_key"],
    ]
    values.extend(user["password"] for user in cfg["users"].values())
    values.extend(tokens.values())
    for value in values:
        text = text.replace(value, "[redacted]")
    text = re.sub(
        r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[redacted JWT]", text
    )
    sys.stderr.write(text)
    sys.stderr.write(
        "\nChat HTTP diagnostics (no message bodies or tokens): "
        + json.dumps(chat_http_events)
        + "\n"
    )


sys.excepthook = sanitized_exception
origin = "http://127.0.0.1:4180"
virtual = "djqhixvlfsbvannoqdjw.supabase.co"
tokens = {}
results = []
chat_http_events = []


def passed(text):
    results.append(text)
    print("PASS: " + text, flush=True)


def api(role, method, path, data=None):
    body = None if data is None else json.dumps(data).encode()
    request = urllib.request.Request(
        origin + path,
        data=body,
        headers={
            "Authorization": "Bearer " + tokens.get(role, cfg["anon_key"]),
            "apikey": cfg["anon_key"],
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        response = urllib.request.urlopen(request, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read()
    try:
        parsed = json.loads(raw)
    except ValueError:
        parsed = None
    return response.status, parsed, raw


for role, user in cfg["users"].items():
    status, data, _ = api(
        None,
        "POST",
        "/auth/v1/token?grant_type=password",
        {"email": user["email"], "password": user["password"]},
    )
    assert status == 200, "Real Auth API sign-in failed: " + role
    tokens[role] = data["access_token"]
passed("six independent synthetic users authenticate against real local Auth")


def png(color):
    def chunk(kind, data):
        return (
            struct.pack("!I", len(data))
            + kind
            + data
            + struct.pack("!I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack("!2I5B", 8, 8, 8, 2, 0, 0, 0))
        + chunk(
            b"IDAT", zlib.compress(b"".join(b"\0" + bytes(color) * 8 for _ in range(8)))
        )
        + chunk(b"IEND", b"")
    )


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"), headless=True
    )
    contexts = []
    pages = {}
    fault = {"remaining": None}
    page_errors = []

    def routing(route):
        url = urllib.parse.urlsplit(route.request.url)
        if url.netloc == virtual:
            if (
                route.request.method == "POST"
                and url.path.startswith("/storage/v1/object/")
                and not url.path.startswith("/storage/v1/object/sign/")
                and fault["remaining"] is not None
            ):
                if fault["remaining"] == 0:
                    fault["remaining"] = None
                    route.abort("failed")
                    return
                fault["remaining"] -= 1
            response = route.fetch(
                url=origin + url.path + ("?" + url.query if url.query else "")
            )
            if url.path in [
                "/rest/v1/classified_messages",
                "/rest/v1/rpc/send_classified_message",
            ]:
                role = next(
                    (
                        role
                        for role, page in pages.items()
                        if page == route.request.frame.page
                    ),
                    "unknown",
                )
                event = {
                    "role": role,
                    "method": route.request.method,
                    "path": url.path,
                    "status": response.status,
                }
                if response.status == 200 and route.request.method == "GET":
                    event["rows"] = len(response.json())
                chat_http_events.append(event)
            route.fulfill(response=response)
        elif url.netloc == "127.0.0.1:4180":
            route.continue_()
        else:
            route.abort()

    def login(role, width=390):
        context = browser.new_context(viewport={"width": width, "height": 844})
        contexts.append(context)
        context.route("**/*", routing)
        context.add_init_script(
            "localStorage.setItem('ryadom_cookie_consent_v1','necessary')"
        )
        page = context.new_page()
        page.on("pageerror", lambda error: page_errors.append(type(error).__name__))
        page.goto(origin + "/#/login")
        page.get_by_label("Электронная почта").fill(cfg["users"][role]["email"])
        page.get_by_label("Пароль", exact=True).fill(cfg["users"][role]["password"])
        page.get_by_role("button", name="Войти по почте").click()
        page.wait_for_url("**/#/profile")
        page.goto(origin + "/#/classifieds")
        expect(
            page.get_by_role("heading", name="Объявления — Енисейск")
        ).to_be_visible()
        pages[role] = page
        return page

    seller = login("seller")
    buyer = login("buyer")
    outsider = login("outsider")
    editor = login("editor", 1440)
    passed(
        "four isolated browser contexts sign in through the application UI on mobile/desktop"
    )
    title = "Синтетический стол " + uuid.uuid4().hex[:8]
    seller.get_by_role("button", name="Мои объявления", exact=True).click()
    seller.get_by_role("button", name="+ Подать объявление").click()
    for label, value in [
        ("Категория", "Тестовая категория"),
        ("Заголовок", title),
        (
            "Описание",
            "Синтетический предмет для проверки реальных Auth, API, RLS и Storage.",
        ),
    ]:
        seller.get_by_label(label, exact=True).fill(value)
    seller.get_by_role("button", name="Сохранить черновик").click()
    card = seller.locator("article").filter(
        has=seller.get_by_role("heading", name=title, exact=True)
    )
    expect(card).to_be_visible()
    status, records, _ = api(
        "seller",
        "GET",
        "/rest/v1/classifieds?select=id,status,title&title=eq."
        + urllib.parse.quote(title),
    )
    assert status == 200 and len(records) == 1
    listing = records[0]["id"]
    assert records[0]["status"] == "draft"
    card.get_by_role("button", name="Изменить", exact=True).click()
    seller.locator(".classifieds-form textarea").fill(
        "Описание исправлено автором в настоящем браузере перед модерацией."
    )
    seller.get_by_role("button", name="Сохранить исправления").click()
    expect(card.get_by_text("Описание исправлено автором", exact=False)).to_be_visible()
    passed(
        "seller creates and edits a real draft through UI; persistence verified over HTTP"
    )

    for role in [None, "buyer", "outsider", "editor", "foreign_editor"]:
        status, rows, _ = api(
            role, "GET", f"/rest/v1/classifieds?select=id&id=eq.{listing}"
        )
        assert status == 200 and rows == [], "Private draft visible to non-author"
    for role in ["seller", "foreign_editor"]:
        status, _, _ = api(
            role,
            "POST",
            "/rest/v1/rpc/review_classified",
            {"p_listing_id": listing, "p_approve": True},
        )
        assert status >= 400
    passed(
        "anonymous/other users/editors cannot read the draft; author/foreign editor cannot publish it"
    )

    def upload(files):
        card.locator("input[type=file]").set_input_files(files)
        card.get_by_role("checkbox").check()
        card.get_by_role("button", name="Загрузить фотографии", exact=True).click()

    file = lambda name, color: {
        "name": name,
        "mimeType": "image/png",
        "buffer": png(color),
    }
    upload([file("one.png", (10, 20, 30)), file("two.png", (40, 50, 60))])
    expect(card.get_by_text("Снимков: 2 из 10")).to_be_visible(timeout=20000)
    image = card.get_by_role("img", name="Фото объявления", exact=False)
    expect(image).to_be_visible()
    assert image.evaluate("(img)=>img.naturalWidth") > 0
    _, photos, _ = api(
        "seller",
        "GET",
        f"/rest/v1/classified_photos?select=id,object_path,slot&listing_id=eq.{listing}",
    )
    assert len(photos) == 2
    for role in ["buyer", "outsider"]:
        status, rows, _ = api(
            role, "GET", f"/rest/v1/classified_photos?select=id&listing_id=eq.{listing}"
        )
        assert status == 200 and rows == []
        status, _, _ = api(
            role,
            "POST",
            "/storage/v1/object/sign/ryadom-classified-photos/"
            + photos[0]["object_path"],
            {"expiresIn": 600},
        )
        assert status >= 400
    passed(
        "real canvas-encoded photographs upload, display and remain private in Storage/RLS"
    )
    status, signed, _ = api(
        "seller",
        "POST",
        "/storage/v1/object/sign/ryadom-classified-photos/" + photos[0]["object_path"],
        {"expiresIn": 3},
    )
    assert status == 200 and signed.get("signedURL")
    signed_path = "/storage/v1" + signed["signedURL"]
    status, _, body = api("seller", "GET", signed_path)
    assert status == 200 and len(body) > 0
    for attempt in range(12):
        time.sleep(0.5)
        status, _, _ = api("seller", "GET", signed_path)
        if status >= 400:
            break
    else:
        raise AssertionError("Short-lived real Storage URL did not expire")
    passed(
        "real Storage signed URL serves the photo before expiry and denies it after expiry"
    )

    card.get_by_role("button", name="Удалить выбранное фото", exact=True).click()
    expect(card.get_by_text("Снимков: 1 из 10")).to_be_visible()
    fault["remaining"] = 1
    upload([file("three.png", (70, 80, 90)), file("four.png", (100, 110, 120))])
    expect(card.get_by_role("alert")).to_be_visible(timeout=20000)
    expect(card.get_by_text("Снимков: 2 из 10")).to_be_visible()
    expect(card.get_by_text("Выбрано файлов: 1.", exact=False)).to_be_visible()
    card.get_by_role("button", name="Загрузить фотографии", exact=True).click()
    expect(card.get_by_text("Снимков: 3 из 10")).to_be_visible(timeout=20000)
    _, photos, _ = api(
        "seller",
        "GET",
        f"/rest/v1/classified_photos?select=id,object_path,slot&listing_id=eq.{listing}",
    )
    assert len(photos) == 3 and len({row["slot"] for row in photos}) == 3
    assert seller.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1")
    passed(
        "owner deletes a photo; interrupted multi-file upload retries only the remainder without duplicates"
    )

    card.get_by_role("button", name="Отправить на проверку", exact=True).click()
    expect(card.get_by_text("Статус: На проверке")).to_be_visible()
    for role in ["seller", "foreign_editor"]:
        status, denied, _ = api(
            role,
            "POST",
            "/rest/v1/rpc/review_classified",
            {"p_listing_id": listing, "p_approve": True},
        )
        assert status == 403 and denied.get("code") == "42501"
        assert "Not authorized" in denied.get("message", "")
    editor.get_by_role("button", name="На проверке", exact=True).click()
    review = editor.locator("article").filter(
        has=editor.get_by_role("heading", name=title, exact=True)
    )
    expect(review).to_be_visible()
    review.get_by_role("button", name="Отклонить", exact=True).click()
    reason_text = "Добавьте подробности состояния товара и реальные фотографии."
    review.get_by_label("Причина отклонения (10–500 символов)").fill(reason_text)
    review.get_by_role("button", name="Подтвердить отклонение").click()
    expect(review).to_have_count(0)
    seller.reload()
    seller.get_by_role("button", name="Мои объявления", exact=True).click()
    expect(card.get_by_text("Статус: Отклонено")).to_be_visible()
    expect(card.get_by_text("Причина отклонения:")).to_be_visible()
    expect(card.get_by_text(reason_text, exact=False)).to_be_visible()
    status, moderation, _ = api(
        "seller", "GET",
        f"/rest/v1/classified_moderation_history?select=decision,reason&listing_id=eq.{listing}"
    )
    assert status == 200 and len(moderation) == 1
    assert moderation[0]["reason"] == reason_text
    status, denied_moderation, _ = api(
        "buyer", "GET",
        f"/rest/v1/classified_moderation_history?select=id&listing_id=eq.{listing}"
    )
    assert status == 200 and denied_moderation == []
    status, hidden, _ = api(
        "buyer", "GET", f"/rest/v1/classifieds?select=id&id=eq.{listing}"
    )
    assert status == 200 and hidden == []
    card.get_by_role("button", name="Изменить", exact=True).click()
    seller.locator(".classifieds-form textarea").fill(
        "Автор исправил отклонённое объявление и повторно направляет его на проверку."
    )
    seller.get_by_role("button", name="Сохранить исправления").click()
    expect(card.get_by_text("Статус: Черновик")).to_be_visible()
    expect(card.get_by_text("Причина отклонения:")).to_have_count(0)
    card.get_by_role("button", name="Отправить на проверку", exact=True).click()
    expect(card.get_by_text("Статус: На проверке")).to_be_visible()
    editor.reload()
    editor.get_by_role("button", name="На проверке", exact=True).click()
    expect(review).to_be_visible()
    review.get_by_role("button", name="Опубликовать", exact=True).click()
    expect(review).to_have_count(0)
    passed(
        "rejected listing stays private; author can correct and resubmit it before publication"
    )
    buyer.reload()
    public = buyer.locator("article").filter(
        has=buyer.get_by_role("heading", name=title, exact=True)
    )
    expect(public).to_be_visible()
    status, rows, _ = api(
        None, "GET", f"/rest/v1/classifieds?select=id,status&id=eq.{listing}"
    )
    assert status == 200 and rows[0]["status"] == "published"
    passed(
        "assigned city editor publishes through UI; foreign city editor is denied; approved listing becomes visible"
    )
    public.get_by_role("button", name="Написать автору", exact=True).click()
    expect(buyer.get_by_label("Сообщение", exact=True)).to_be_visible()
    message = "Синтетическое сообщение покупателя " + uuid.uuid4().hex[:6]
    buyer.get_by_label("Сообщение", exact=True).fill(message)
    with buyer.expect_response(
        lambda response: response.url.endswith("/rest/v1/rpc/send_classified_message")
        and response.request.method == "POST"
    ) as sent:
        buyer.get_by_role("button", name="Отправить", exact=True).click()
    assert sent.value.status == 200, "Buyer message RPC did not commit"
    expect(
        buyer.locator(".classifieds-message").get_by_text(message, exact=True)
    ).to_be_visible()
    seller.get_by_role("button", name="Сообщения", exact=True).click()
    _, threads, _ = api(
        "seller",
        "GET",
        f"/rest/v1/classified_conversations?select=id&listing_id=eq.{listing}",
    )
    assert len(threads) == 1
    thread = threads[0]["id"]
    status, saved, _ = api(
        "seller",
        "GET",
        f"/rest/v1/classified_messages?select=body&conversation_id=eq.{thread}",
    )
    assert status == 200 and any(
        row["body"] == message for row in saved
    ), "Committed buyer message is not readable by the seller"
    seller.locator(".classifieds-thread-list button").filter(
        has_text=listing[:8]
    ).click()
    expect(
        seller.locator(".classifieds-message").get_by_text(message, exact=True)
    ).to_be_visible()
    seller.get_by_label("Сообщение", exact=True).fill("Синтетический ответ автора")
    with seller.expect_response(
        lambda response: response.url.endswith("/rest/v1/rpc/send_classified_message")
        and response.request.method == "POST"
    ) as sent:
        seller.get_by_role("button", name="Отправить", exact=True).click()
    assert sent.value.status == 200, "Seller message RPC did not commit"
    expect(
        seller.locator(".classifieds-message").get_by_text(
            "Синтетический ответ автора", exact=True
        )
    ).to_be_visible()
    buyer.get_by_role("button", name="Обновить сообщения", exact=True).click()
    expect(buyer.get_by_text("Синтетический ответ автора", exact=True)).to_be_visible()
    for table in ["classified_conversations", "classified_messages"]:
        status, rows, _ = api("outsider", "GET", f"/rest/v1/{table}?select=id")
        assert status == 200 and rows == []
    status, denied, _ = api(
        "outsider",
        "POST",
        "/rest/v1/rpc/send_classified_message",
        {"p_conversation_id": thread, "p_body": "Недопустимое сообщение"},
    )
    assert status == 403 and denied.get("code") == "42501"
    assert "Conversation unavailable" in denied.get("message", "")
    status, denied, _ = api(
        "buyer",
        "POST",
        "/rest/v1/classified_messages",
        {
            "conversation_id": thread,
            "sender_id": cfg["users"]["seller"]["id"],
            "body": "Подмена отправителя",
        },
    )
    assert status == 403 and denied.get("code") == "42501"
    passed(
        "real private messages travel in both UIs; outsider reads/sends and sender spoofing are denied over HTTP"
    )
    buyer.get_by_role("button", name="Заблокировать собеседника", exact=True).click()
    expect(
        buyer.get_by_role("button", name="Разблокировать собеседника", exact=True)
    ).to_be_visible()
    status, denied, _ = api(
        "seller",
        "POST",
        "/rest/v1/rpc/send_classified_message",
        {"p_conversation_id": thread, "p_body": "После блокировки"},
    )
    assert status == 403 and denied.get("code") == "42501"
    assert "Conversation blocked" in denied.get("message", "")
    passed("participant blocking prevents further messages at the server")

    # The owner can remove a live listing without broad UPDATE privileges.
    for role in ["buyer", "outsider", "editor", "foreign_editor", None]:
        status, denied, _ = api(
            role,
            "POST",
            "/rest/v1/rpc/archive_classified",
            {"p_listing_id": listing},
        )
        assert status >= 400 and denied.get("code") == "42501", (
            "A non-owner or anonymous request archived someone else's listing"
        )
    seller.get_by_role("button", name="Мои объявления", exact=True).click()
    expect(card.get_by_text("Статус: Опубликовано")).to_be_visible()
    prompts = []
    seller.once("dialog", lambda dialog: (prompts.append(dialog.message), dialog.accept()))
    card.get_by_role("button", name="Снять с публикации").click()
    assert prompts and "Снять объявление с публикации" in prompts[0]
    expect(card.get_by_text("Статус: В архиве")).to_be_visible()
    expect(card.get_by_role("button", name="Снять с публикации")).to_have_count(0)

    status, own_rows, _ = api(
        "seller", "GET", f"/rest/v1/classifieds?select=id,status&id=eq.{listing}"
    )
    assert status == 200 and own_rows[0]["status"] == "archived"
    for role in [None, "buyer", "outsider"]:
        status, rows, _ = api(
            role, "GET", f"/rest/v1/classifieds?select=id,status&id=eq.{listing}"
        )
        assert status == 200 and rows == [], "Archived listing leaked to non-owner"
    for endpoint, payload in [
        ("/rest/v1/rpc/open_classified_conversation", {"p_listing_id": listing}),
        (
            "/rest/v1/rpc/send_classified_message",
            {"p_conversation_id": thread, "p_body": "После архива"},
        ),
    ]:
        status, denied, _ = api("buyer", "POST", endpoint, payload)
        assert status == 403 and denied.get("code") == "42501"
        assert "unavailable" in denied.get("message", "").lower()
    status, preserved, _ = api(
        "seller", "GET",
        f"/rest/v1/classified_messages?select=body&conversation_id=eq.{thread}",
    )
    assert status == 200 and any(row["body"] == message for row in preserved)
    buyer.get_by_role("button", name="Объявления", exact=True).click()
    expect(public).to_have_count(0)
    passed(
        "real owner archive requires confirmation; all other roles denied; "
        "public listing disappears, new chat stops and existing messages remain private"
    )
    assert not page_errors, "Unexpected JavaScript page errors"
    for context in contexts:
        # All assertions already passed. During teardown the app may still
        # have in-flight refresh requests; do not treat a late double-fulfill
        # while disconnecting the browser as an application/test failure.
        context.set_offline(True)
        context.unroute_all(behavior="ignoreErrors")
        context.close()
    browser.close()
(args.workdir / "report.json").write_text(
    json.dumps(
        {
            "scope": "local full UI/Auth/PostgREST/Storage with synthetic accounts; no remote production/test project requests",
            "passed": results,
            "listing_id": listing,
        },
        ensure_ascii=False,
        indent=2,
    )
)
print(str(len(results)) + " local multi-user E2E stages passed")
