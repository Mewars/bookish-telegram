# VK ID: подготовка входа в «Рядом»

**Статус:** подготовка интерфейса, не проверенная интеграция. По умолчанию VK ID отключён. Не включайте флаг и не объединяйте PR, пока не проверена совместимость.

## Архитектура

Приложение уже использует Supabase Auth (PKCE) и `custom:yandex`. Предлагаемый вариант для VK — `custom:vk` через `supabase.auth.signInWithOAuth`. Supabase Custom OAuth поддерживает OAuth2/OIDC и серверный обмен кодов, но **это не гарантирует совместимость с VK ID OAuth 2.1**. VK может требовать дополнительные поля при token exchange (например, `device_id`), которые стандартный Custom OAuth не передаёт. Не используйте устаревший VK OAuth вместо VK ID и не отключайте PKCE ради обхода ограничений.

## Что проверить до включения

1. Создайте веб-приложение VK ID в официальном кабинете. APP_ID и секреты не добавляйте в frontend и Git.
2. В тестовом Supabase откройте Authentication → Providers → New Provider и изучите Custom OAuth/OIDC. Выберите OAuth2 или OIDC **только после проверки реальных endpoint/discovery и требований VK ID**.
3. Если совместимость подтверждена, настройте `custom:vk`, используйте **точный Callback URL из Supabase Dashboard** в VK ID и проверьте UserInfo и стабильный идентификатор пользователя. Для провайдера без email может потребоваться `email_optional`.
4. Разрешите тестовый redirect в Supabase Auth → URL Configuration. Протестируйте успешный вход, отмену, ошибку, повторный вход, выход, восстановление сессии и RLS. Не меняйте production без согласования.
5. Только после успешного end-to-end теста установите `VITE_VK_AUTH_READY=true` в тестовой сборке. Флаг включает кнопку, но не настраивает провайдера. В production включать только с разрешения владельца.

## Официальные источники

- https://supabase.com/docs/guides/auth/custom-oauth-providers
- https://supabase.com/docs/guides/auth/redirect-urls
- https://vkcom.github.io/vkid-web-sdk/docs/index.html
- https://id.vk.ru/about/business/go/docs/ru/vkid/latest/vk-id/connection/create-application
