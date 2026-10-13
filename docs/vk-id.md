# VK ID → OAuth2 bridge → Supabase Auth

Код bridge реализован в `supabase/functions/vk-oauth-bridge/`, SQL для его хранилища — `docs/sql/vk-oauth-bridge.sql`. Ничего не развёрнуто и не применено к рабочему Supabase. Флаг `VITE_VK_ID_ENABLED=false` сохранён. Реального VK-входа и Supabase session в живом проекте пока не проверяли.

## Возможность бесплатного размещения

Supabase Free допускает до трёх custom OAuth/OIDC providers. Яндекс и VK занимают два места. Bridge использует одну Edge Function, Web Crypto и PostgreSQL текущего проекта, без платных доменов, Redis, внешнего сервера, cron или HTML-страниц. Edge Free допускает 150 секунд wall clock и 2 секунды CPU; сетевые операции ограничены 8/10 секундами. Хранилище и вызовы расходуют обычные Free-квоты проекта; их наличие в данном Dashboard не проверялось. При исчерпании квоты/паузе проекта вход недоступен, а не подменяется фиктивной сессией.

HTML на стандартном Edge-домене ограничен платформой, но здесь не нужен: публичные endpoints возвращают только HTTP redirects или JSON. Каждая стадия завершается отдельным запросом, поэтому пользовательское ожидание VK не удерживает Edge worker.

## Точные URL для этого проекта

Supabase Project ID: `cptbmepnbzogqkfhflsg`. VK App ID: `54818827`.

| Назначение | Значение |
| --- | --- |
| Сайт VK-приложения | `https://ryadomcity.ru/` |
| Домен сайта | `ryadomcity.ru` |
| VK Redirect URI — возвращение **из VK в bridge** | `https://cptbmepnbzogqkfhflsg.supabase.co/functions/v1/vk-oauth-bridge/callback` |
| Supabase Authorization URL | `https://cptbmepnbzogqkfhflsg.supabase.co/functions/v1/vk-oauth-bridge/authorize` |
| Supabase Token URL | `https://cptbmepnbzogqkfhflsg.supabase.co/functions/v1/vk-oauth-bridge/token` |
| Supabase UserInfo URL | `https://cptbmepnbzogqkfhflsg.supabase.co/functions/v1/vk-oauth-bridge/userinfo` |
| Redirect URI клиента Supabase — **из bridge в Supabase Auth** | `https://cptbmepnbzogqkfhflsg.supabase.co/auth/v1/callback` |
| Supabase Site URL / frontend redirect после входа | `https://ryadomcity.ru/` |

Callback VK и callback Supabase — разные адреса. Не ставьте в VK callback статический сайт или `/auth/v1/callback`. Bridge принимает ровно указанный Supabase redirect URI, без wildcard, дополнительных query, подмены host или другого client ID. Callback URL в Dashboard провайдера должен совпасть с таблицей; если платформа показывает иной адрес, остановитесь и пересмотрите allowlist в коде, не ослабляйте её wildcard.

## Протокол и безопасность

1. Supabase Auth вызывает authorize с собственными `state`, S256 PKCE challenge и клиентом `ryadom-vk-supabase`. Bridge проверяет все параметры и фиксированный redirect. Затем создаёт **другие** state и PKCE verifier для VK.
2. В PostgreSQL хранится попытка на 10 минут, зашифрованная AES-256-GCM. В качестве ключей поиска — SHA-256 digest случайных 256-битных handles; raw handles не хранятся. AES additional data привязывает ciphertext к типу и digest записи. Downstream state, verifier и browser binding находятся внутри ciphertext.
3. Browser binding — случайная cookie `__Host-ryadom-vk-<state>`, `Secure; HttpOnly; SameSite=Lax; Path=/`, без Domain. Callback требует state и cookie той же попытки; неверная cookie не уничтожает чужую попытку. Это защита от login CSRF, а не замена PKCE. Одновременные попытки используют разные cookie.
4. Валидная попытка атомарно погашается `DELETE ... RETURNING` перед запросом к VK. Bridge передаёт code, device_id, verifier, state и callback **в POST body** `/oauth2/auth`. VK access token также передаётся **в POST body** `/oauth2/user_info`. Hosts фиксированы, HTTP redirects upstream запрещены. ID из `user_info.user.user_id` должен совпасть с `token.user_id`.
5. Полученный `sub` — стабильный VK ID. Email и phone **вообще не включаются** в userinfo, даже если VK их вернул. Не запрашиваются email/phone scopes. Нет фиктивного email и `email_verified=true`; Supabase должен работать с `email_optional=true`.
6. Bridge выдаёт Supabase одноразовый code на 120 секунд. Token endpoint требует Client Secret (HTTP Basic или form) и собственный Supabase S256 verifier. Неверный secret/redirect/PKCE не позволяет погасить код. При параллельном правильном обмене выигрывает только один запрос.
7. Token response содержит непрозрачный bridge bearer на 60 секунд, **без refresh token и без VK-токена**. Userinfo атомарно погашает bearer при первом обращении. Если Supabase включает этот provider_token в клиентскую session, он уже недействителен; существующий authStorage не сохраняет provider tokens. Настоящие Supabase access/refresh tokens для штатной клиентской сессии остаются механизмом Supabase Auth. Никаких самодельных Supabase JWT/сессий нет.
8. VK access/refresh tokens не сохраняются даже зашифрованными, не возвращаются frontend и не добавляются в URL. Обычные OAuth authorization codes и случайные state проходят через callback URL согласно протоколу; токены/секреты — нет. Функция не логирует запросы, тела, Cookie, credentials или upstream errors. Платформенные access logs с callback URLs тоже ограничьте по доступу/сроку хранения.
9. Все ответы — `no-store`, `no-referrer`, `nosniff`, без CORS. Request body ограничен 8 KiB, upstream JSON — 32 KiB. Глобальные PostgreSQL buckets: 120 authorize/min и 600 остальных запросов/min. Это ограничение работы bridge, не защита всей бесплатной invocation-квоты от внешнего flood; при злоупотреблении выключите bridge и используйте доступные ограничения платформы.
10. Закрытая схема `vk_bridge_private` с RLS без публичных policies. `anon`/`authenticated` не могут читать таблицы или вызывать RPC. Доступ к четырём операциям над зашифрованными records и rate limiter разрешён только server `service_role` через две ограниченные SECURITY DEFINER функции с пустым search_path. RPC не обращаются к auth.users, profiles, identities или favorites. Cleanup просроченных records выполняется ограниченными пачками при новых insert. При отключённом bridge старые ciphertext остаются до следующего cleanup/ручной очистки владельцем.

## Штатная сессия, профиль и существующие аккаунты

Только Supabase Auth создаёт/восстанавливает session, связывает provider subject с auth identity и своим UUID. При повторном VK-входе `sub` остаётся тем же, поэтому Supabase использует ту же identity. Это поведение надо подтвердить на реальном тесте; локальные fixtures проверяют стабильность subject и протокол, а не живой auth.users.

Яндекс `custom:yandex`, email Auth, RLS, account/guest favorites не заменяются. SQL bridge не меняет их таблицы/триггеры. Поля пустого VK-профиля заполняются из `auth.getUser()` verified identity, через действующие own-user update и условное сравнение предыдущих значений. Редактированные имя/аватар не перезаписываются. VK-способ входа показывается из действующей Supabase identity, без вставки в публичную user_identities; исторические строки этой таблицы продолжают читаться. При ошибке profile enrichment session остаётся доступной.

Существующий Яндекс/email аккаунт автоматически с новым VK по имени/email не объединяется: bridge не передаёт email. Если владелец хочет вручную связать способы входа в один аккаунт, нужен отдельный UX повторного подтверждения и штатный Supabase identity linking. Этот PR такое связывание не вводит.

## Действия владельца — не выполнены агентом

### 1. Проверить VK App 54818827

В [кабинете VK ID](https://id.vk.ru/about/business/go) открыть это приложение, убедиться, что доступна веб-платформа. Сайт и Redirect URI задать по таблице выше; подтвердить требуемые VK настройки домена/доступа приложения. Минимальный scope: `vkid.personal_info`, без email/phone. Проверить, что авторизация через ID VK разрешена для тестового аккаунта.

Публичный VK Client ID — `54818827`. Это **не** Client ID для настройки custom:vk в Supabase: у Supabase будет отдельный клиент bridge. Если выбранный VK server flow требует Client Secret, взять его в кабинете VK и сохранить только как Edge secret `VK_APP_SECRET`; официальный PKCE web SDK обменивает код без secret, поэтому в коде он необязателен. Не добавлять его в `VITE_*` и Git.

### 2. Проверить и вручную установить SQL

Сначала ревью `docs/sql/vk-oauth-bridge.sql` и локальный `npm run test:vk-bridge`. В SQL Editor целевого проекта вручную выполнить файл **один раз** после собственного согласования. Он создаёт только `vk_bridge_private.records`, `rate_limits`, индекс и две RPC; не меняет существующих пользователей/аккаунты/RLS. Не публиковать private schema через Data API. Повторное применение файла завершается ошибкой и транзакция откатывается; это не миграция existing account schema.

### 3. Сгенерировать и сохранить server secrets

Выполнить дважды **на своём компьютере**, результат каждого вызова сохранить в менеджер секретов:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Два независимых значения: `VK_BRIDGE_CLIENT_SECRET` и `VK_BRIDGE_ENCRYPTION_KEY` (по 43 base64url символа). Не публиковать вывод в чат/issue/PR. Клиентский Secret bridge также понадобится в Supabase custom provider. Encryption key — только Edge; смена ключа отменяет оставшиеся попытки/коды, существующие Supabase sessions не меняет.

В Dashboard → Edge Functions → Secrets (или CLI с файлом вне репозитория) задать:

| Server secret | Значение |
| --- | --- |
| `VK_APP_ID` | `54818827` |
| `VK_BRIDGE_CLIENT_ID` | `ryadom-vk-supabase` |
| `VK_BRIDGE_CLIENT_SECRET` | первый сгенерированный secret |
| `VK_BRIDGE_ENCRYPTION_KEY` | второй сгенерированный secret |
| `VK_APP_SECRET` | при необходимости server VK Secret |
| `VK_BRIDGE_ENABLED` | сначала `false` |

Hosted runtime предоставляет `SUPABASE_SERVICE_ROLE_KEY` автоматически. Его нельзя переносить во frontend. Bridge использует его только для своих server-side RPC. Пример имён без секретов: `supabase/functions/vk-oauth-bridge/.env.example`.

### 4. Вручную развернуть одну функцию

После своего ревью и установки SQL выполнить со своего CLI:

```sh
supabase functions deploy vk-oauth-bridge --project-ref cptbmepnbzogqkfhflsg
```

В репозитории указан `verify_jwt=false`: authorize/callback происходят до Supabase login, token получает Basic/form credentials, userinfo — одноразовый bridge Bearer. Общая JWT-проверка gateway не подходит этим OAuth endpoints; они проверяются внутри bridge. Не отключать JWT-проверку у других функций. При `VK_BRIDGE_ENABLED=false` функция отвечает 503 без операций с БД.

### 5. Создать custom:vk в Supabase Auth

Dashboard → Authentication → Providers → New Provider → **Manual/OAuth2**, не OIDC. Только для нового VK провайдера:

| Поле | Значение |
| --- | --- |
| Identifier | `custom:vk` |
| Name | `VK ID` |
| Client ID | `ryadom-vk-supabase` |
| Client Secret | значение `VK_BRIDGE_CLIENT_SECRET` |
| Authorization URL / Token URL / UserInfo URL | точные адреса из первой таблицы |
| Scopes | `profile` (не email/openid/offline_access) |
| PKCE enabled | `true` |
| Email optional | `true` — обязательно |
| Authorization params | пустой объект |
| Acceptable client IDs / attribute mapping | не добавлять обходы проверки/подтверждения email |

Если Dashboard не показывает email_optional, использовать поддерживаемую admin customProviders конфигурацию **только вручную в защищённом server/CLI окружении**; поле присутствует в официальной документации и API. Не включать email autoconfirm глобально, не менять Яндекс. Если hosted проект не принимает email_optional, остановить подключение: без него bridge не должен выдумывать email. Проверить свободный слот custom provider и Free-квоты.

Site URL остаётся `https://ryadomcity.ru/`. Redirect allowlist frontend должен разрешать этот адрес; recovery/email/Yandex адреса не удалять. Не разрешать произвольные third-party redirects. Разрешённый клиент bridge имеет только один callback Supabase из таблицы.

### 6. Сквозной тест до включения кнопки

Развернуть/настроить bridge и provider может только владелец. После готовности включить **backend** `VK_BRIDGE_ENABLED=true`, оставив frontend flag false. В защищённом тестовом frontend с текущими публичными Supabase URL/key вручную вызвать штатный `signInWithOAuth({provider:'custom:vk',options:{redirectTo:'https://ryadomcity.ru/'}})` и пройти VK тестовым аккаунтом. Тестовый frontend должен применять существующее согласие на обработку данных, не обходить его.

Проверить:

- Реальные ответы VK, совпадение token/user_info user_id, выдачу штатной Supabase session и отсутствие email у новой VK identity.
- Повторный вход сохраняет тот же auth.users UUID; существующий Яндекс/email UUID и данные не меняются.
- Отказ VK, неверные/просроченные state, callback без cookie, повтор callback/code и неверный PKCE не создают session.
- Работа Secure/HttpOnly/Lax cookie через **настоящий Edge gateway**: её выдача, возврат из VK и удаление. Локальный браузерный тест не доказывает поведение hosted gateway, Safari или настроек VK.
- VK upstream tokens не появляются в browser URL/network payload/storage; one-use bridge bearer уже непригоден после userinfo.
- getUser/getSession, refresh Supabase session после истечения access token, logout/reload, профиль, избранное на двух устройствах, изоляция аккаунтов/RLS.
- Regression Яндекса и email login/recovery. Desktop, Android, iPhone/Safari. Проверить VK mobile return и настройки приложения.

При любой ошибке оставить frontend кнопку отключённой и вернуть `VK_BRIDGE_ENABLED=false`. Не принимать локальный PASS за реальный вход. Реальных токенов/секретов в отчёт не вставлять.

### 7. Включить frontend только после PASS

Только после полного теста добавить `VITE_VK_ID_ENABLED=true` в build environment и пересобрать сайт. Текущий Build Sprinthost ZIP в этом PR **не изменяется**: передача нового flag в его env и ручная публикация ZIP — отдельное действие владельца после одобрения. Создание repo variable без передачи её в build env не включает кнопку. DNS и Спринтхост bridge не нужны.

## Проверки в PR

**Результаты этого PR:** `npm run lint`, `npm run build`, `npm run test` — PASS, 126 тестов (33 новых проверок bridge/SQL/профиля); `git diff --check` — PASS. Настоящий `deno check supabase/functions/vk-oauth-bridge/index.ts` — PASS. Браузерный local TLS fixture desktop/mobile — PASS. Реальные VK/Supabase sessions, gateway, refresh/logout/cross-device RLS и Safari не проверены.

`npm run test:vk-bridge` входит в `npm test`: protocol/ошибки/replay/crypto/лимиты, реальный PostgreSQL WASM (PGlite) для permissions/expiry/atomicity/нескольких instances, verified profile enrichment. Настоящий Deno check отдельно проверяет Edge entrypoint. Optional browser fixture: `python tests/vk-bridge-browser.py` (Playwright, Chromium, OpenSSL): настоящий локальный TLS, cross-site redirects и cookie desktop/mobile. VK и Supabase mocked; запросов к живой базе нет.

Код может работать на бесплатном Edge+Postgres в пределах квот; альтернативный платный сервер не нужен. Если конкретный проект/VK app или gateway окажутся несовместимыми на сквозном тесте, bridge остаётся выключенным до исправления. Бесплатная альтернатива при ограничениях gateway — Cloudflare Workers Free + транзакционное хранилище D1 с теми же state/PKCE/one-use гарантиями и штатным custom:vk; перенос и новый callback должны быть отдельно реализованы и проверены, здесь они не развёрнуты.

## Первичные источники (проверены 13 октября 2026)

- [Supabase custom OAuth/OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers): Free slots, PKCE, email_optional, server options.
- [Supabase Edge limits](https://supabase.com/docs/guides/functions/limits): runtime, HTML/custom domain restriction.
- [Официальный VK SDK exchangeCode/userInfo](https://github.com/VKCOM/vkid-web-sdk/blob/master/src/auth/auth.ts) и [типы ответов](https://github.com/VKCOM/vkid-web-sdk/blob/master/src/auth/types.ts): device_id, POST body, user_id. Актуальные constants официального SDK указывают `id.vk.ru`, этот host зафиксирован в коде ([constants.ts](https://github.com/VKCOM/vkid-web-sdk/blob/master/src/constants.ts)); автоматические переходы с другого домена не разрешены. Основная страница VK docs не открылась из исследовательского инструмента; протокол сверялся с официальным SDK, не с сторонним примером.
- [Supabase Auth custom OAuth implementation](https://github.com/supabase/auth/blob/master/internal/api/provider/custom_oauth.go) и [external callback](https://github.com/supabase/auth/blob/master/internal/api/external.go): claims, EmailOptional и штатное создание/поиск identity.
