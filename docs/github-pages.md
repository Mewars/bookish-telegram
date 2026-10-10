# Тестовый GitHub Pages

Ожидаемый адрес: https://mewars.github.io/bookish-telegram/

Это отдельное тестовое размещение. Netlify и ryadomcity.ru не меняются.
Обычная команда `npm run build` сохраняет Vite base `/`.
Команда `npm run build:pages` использует mode `github-pages` и base `/bookish-telegram/`.
Hash-маршруты сохраняются, например `/bookish-telegram/#/places` и `/bookish-telegram/#/admin/import`.

## Настройки GitHub

1. В репозитории откройте **Settings → Pages → Build and deployment**.
2. В **Source** выберите **GitHub Actions**. Вариант Deploy from a branch не нужен.
3. **Custom domain** оставьте пустым: этот тест не использует ryadomcity.ru. CNAME не добавляется.
4. Если Actions отключены, разрешите запуск workflows в **Settings → Actions → General** и использование официальных actions из workflow. Общие write permissions для всех workflows не нужны: deploy job запрашивает `pages: write` и `id-token: write` отдельно.
5. В **Settings → Environments → github-pages** проверьте правила deployment branches: ветка `mewars` должна быть разрешена. Если настроены required reviewers, публикация ожидает их подтверждения.

Workflow `.github/workflows/github-pages.yml` проверяет сборку в PR в `mewars`, но не публикует PR.
После merge в `mewars` push запускает build и deploy автоматически. Эта задача merge не выполняет.
Повторный запуск: **Actions → Test GitHub Pages → Run workflow → Branch: mewars → Run workflow**.
При ручном запуске другой ветки выполняется только build, без deploy.
URL опубликованного сайта появится в summary deploy job / environment `github-pages`.

## Auth и карты на тестовом домене

Настройки Netlify не копируются в GitHub Actions автоматически.
Для полного тестирования задайте repository secrets в **Settings → Secrets and variables → Actions**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — только публичный browser publishable key, не service role / secret key.
- `VITE_YANDEX_MAPS_API_KEY` — если нужна встроенная карта.

Эти Vite-переменные встраиваются в публичную клиентскую сборку. Без Supabase-переменных приложение работает в существующем гостевом режиме; при отсутствии ключа карты остаются внешние ссылки.
Для входа добавьте `https://mewars.github.io/bookish-telegram/` в **Supabase → Authentication → URL Configuration → Redirect URLs**, сохранив существующие адреса Netlify/production и Site URL.
OAuth-провайдер остаётся `custom:yandex`, его callback на Supabase не меняется. В коде меняется только путь возврата в приложение с учётом Vite base.
Если ключ Яндекс Карт ограничен доменами, разрешите `mewars.github.io` дополнительно к существующим доменам.
Избранное/согласия/настройки в браузере на GitHub Pages имеют отдельное origin-хранилище от Netlify.

## Локальная проверка

```sh
npm ci
npm run build
npm run lint
npm run build:pages
npm run preview -- --mode github-pages
```

Откройте `http://localhost:4173/bookish-telegram/` (или порт, указанный Vite).
Проверьте hero, favicon, CSS/JS, переходы `#/places`, `#/login`, обновление страницы и importer `#/admin/import`.
После проверки Pages снова выполните `npm run build`, если нужен `dist/` для обычного root deployment.
