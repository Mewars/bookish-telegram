# Подготовка VK ID

Сайт сохраняет Supabase Auth как единственный источник сессии. Клиентский путь подготовлен: LoginPage после согласия вызывает signInWithOAuth с provider custom:vk, обработкой отказа и запретом повторного нажатия. По умолчанию VITE_VK_ID_ENABLED=false; этот флаг не создаёт провайдера и не делает вход рабочим сам по себе.

## Что нужно для реального подключения

1. Открыть [кабинет VK ID](https://id.vk.com/about/business/go), создать приложение типа «Веб», указать сайт https://ryadomcity.ru/ и домен ryadomcity.ru. Client ID берётся в настройках созданного приложения. Серверные секреты хранить только в серверной конфигурации.
2. Подготовить совместимый серверный OAuth/OIDC провайдер для Supabase с идентификатором vk. VK ID использует PKCE и возвращает device_id, который нужен при обмене кода на токены. Простое указание VK token URL в generic OAuth настройках не гарантирует передачу device_id. Нужен проверенный совместимый провайдер либо серверный OAuth bridge; реализация bridge в этот PR не входит.
3. Серверный bridge должен проверять state и redirect URI, связывать device_id с одноразовой короткоживущей попыткой входа, выполнять PKCE-обмен и получать профиль непосредственно от VK. Он должен предоставлять стандартные token/userinfo либо OIDC endpoints для Supabase. VK userInfo — POST с client_id и access_token, а не обычный OIDC userinfo с Bearer GET; требуется адаптация ответа. Нельзя принимать браузерный user_id, имя, email или access token за готовую сессию Рядом.
4. В Supabase настроить custom:vk, client ID/secret bridge, authorize/token/userinfo endpoints, PKCE и минимальные scopes. В VK разрешить callback bridge; в bridge разрешить только точный Supabase callback https://<project-ref>.supabase.co/auth/v1/callback. В Supabase Site URL и allowlist redirect URL разрешить https://ryadomcity.ru/ и отдельно нужные тестовые адреса.
5. Для userinfo использовать стабильный VK subject. Не объявлять email подтверждённым, если VK не предоставляет проверяемое подтверждение. Безопасное связывание с существующим email/Яндекс аккаунтом требует подтверждения владельца; не связывать аккаунты по имени или неподтверждённому email. Отдельно проверить поведение Supabase для пользователя без email.
6. Проверить полный цикл на тестовом окружении: вход, отмену и отказ, неверный state/PKCE, повтор кода, восстановление и обновление Supabase session, профиль, выход, изоляцию RLS и синхронизацию избранного. После этого включить VITE_VK_ID_ENABLED=true в сборке. Переменную нужно передать хостингу; для GitHub Actions/Sprinthost — дополнить build env отдельным изменением.

Никаких изменений production Supabase, базы, секретов, аккаунтов или разрешённых redirect URL этот PR не выполняет. Настоящий VK-вход пока не проверен и по умолчанию недоступен. Клиентская подготовка проверяется локальными fixtures, которые не являются реальной авторизацией.

## Рекомендуемая серверная архитектура

Браузер → Supabase authorize custom:vk → OAuth bridge → VK ID → callback bridge → одноразовый код bridge → Supabase callback → token/userinfo bridge → полноценная Supabase session. Это два независимых OAuth-перехода с отдельными state/PKCE. Bridge хранит upstream VK токены на сервере, а выдаваемые им токены доступны только Supabase. Клиент сайта не получает VK access token, client secret или service_role. Подписанные OIDC ID tokens bridge при выборе OIDC проверяются Supabase по issuer, audience и JWKS.

Bridge можно разместить как отдельный проверенный сервис или Supabase Edge Function. Для варианта функции vk-oidc точный callback в кабинете VK: https://<project-ref>.supabase.co/functions/v1/vk-oidc/callback. Это проектируемый маршрут, пока не реализован и не развёрнут. В настройках bridge redirect клиента Supabase: https://<project-ref>.supabase.co/auth/v1/callback. Callback VK не должен указывать прямо на статический сайт или Supabase callback, если выбран bridge. Project ref нужно взять из своего Supabase Dashboard; без него и выбора размещения нельзя предоставить действующий полный redirect URI.

Владелец должен сначала выбрать и настроить совместимый bridge; затем добавить провайдера custom:vk в Supabase. Секрет клиента Supabase↔bridge хранится в Supabase Dashboard и server secrets bridge, VK secret (если требуется для выбранного flow) — только в bridge. Использовать внешний проверенный провайдер предпочтительнее самостоятельного сервера без аудита. Полноценная реализация и развёртывание bridge — отдельный необходимый серверный этап; один Client ID и переключение флага его не заменяют.

## Источники протокола

- [Supabase custom OAuth/OIDC](https://supabase.com/docs/guides/auth/custom-oauth-providers): идентификаторы custom: и серверная конфигурация.
- [Supabase Auth custom provider](https://github.com/supabase/auth/blob/master/internal/api/provider/custom_oauth.go): стандартный Exchange с OAuth options и userinfo claims; передачи VK device_id по одной frontend-настройке нет.
- [Официальный VK ID SDK, exchangeCode](https://github.com/VKCOM/vkid-web-sdk/blob/master/src/auth/auth.ts): code_verifier и device_id при обмене authorization code.
- [VK ID SDK API](https://vkcom.github.io/vkid-web-sdk/docs/classes/auth.Auth.html): exchangeCode и userInfo.
