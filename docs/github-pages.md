# Production GitHub Pages: ryadomcity.ru

Production URL: https://ryadomcity.ru/

`npm run build:pages` использует mode `github-pages` и Vite base `/`.
Обычная `npm run build` для Netlify также использует `/`.
`npm run build:pages:test` сохраняет необязательную сборку `/bookish-telegram/` (mode `github-pages-test`). Production workflow её не использует.
Hash-маршруты сохраняются: `/#/places`, `/#/login`, `/#/admin/import`.
Hero, favicon, CSS и JS доступны через `/brand/...` и `/assets/...`, без `/bookish-telegram/`.

## До переключения

1. Сохраните текущие DNS-записи для возврата на Netlify при необходимости.
2. В **Settings → Secrets and variables → Actions → Repository secrets** задайте те же публичные production-параметры, что используются Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — публичный browser key формата `sb_publishable_…`, не service_role / secret key.
   - `VITE_YANDEX_MAPS_API_KEY` — если встроенная карта использует ключ; сохраните существующие ограничения для `ryadomcity.ru`.
   Значения Netlify не переносятся в Actions автоматически. Production deploy останавливается, если отсутствуют два Supabase secrets, чтобы не опубликовать гостевую сборку вместо работающего Auth. Эти Vite-параметры встраиваются в публичный frontend.
3. Production-домен остаётся тем же. Существующие Supabase Site URL, redirect URL `https://ryadomcity.ru/`, callback `custom:yandex`, Yandex ID и Telegram Mini App URL без необходимости не менять.
4. По желанию подтвердите владение доменом в **личных GitHub Settings → Pages → Add a domain**. Значение TXT GitHub выдаёт индивидуально; его нельзя заменить универсальным значением. Оно не меняет текущий хостинг.

## После merge: Settings → Pages, затем DNS

1. В **Mewars/bookish-telegram → Settings → Pages → Build and deployment → Source** выберите **GitHub Actions**.
2. В **Settings → Environments → github-pages** разрешите deployment из `mewars`. Если требуются reviewers, подтвердите deployment.
3. Дождитесь успешного workflow **Production GitHub Pages** из ветки `mewars`. Push после merge запускает build и deploy; ручной повтор: **Actions → Production GitHub Pages → Run workflow → Branch: mewars**. В PR deploy пропускается.
4. В **Settings → Pages → Custom domain** укажите **ryadomcity.ru**, без `https://` и пути, нажмите **Save**. Сначала привяжите домен в GitHub, затем переключайте DNS.
5. Измените DNS-записи по таблице ниже. Дождитесь успешной DNS-проверки и выпуска сертификата GitHub Pages.
6. Включите **Settings → Pages → Enforce HTTPS**, когда опция станет доступна. DNS и сертификат могут обновляться до 24 часов.
7. Проверьте `https://ryadomcity.ru/` и `https://www.ryadomcity.ru/` (редирект на основной домен), assets, hash reload, Auth и основные экраны на desktop/iPhone.

В Actions deployment `CNAME`-файл не требуется и игнорируется: custom domain задаётся в Pages settings. Поэтому в проект не добавлен `public/CNAME` или другой файл CNAME.
После привязки custom domain исходный `mewars.github.io/bookish-telegram/` может перенаправлять на production-домен; это уже не независимый test hosting.

## Точные DNS-записи

У DNS-провайдера замените прежние Netlify-записи для apex (`@` / `ryadomcity.ru`) и `www`, а не добавляйте новые рядом со старыми. TTL можно поставить 300 секунд на время переключения, если провайдер разрешает.

| Имя | Тип | Значение |
| --- | --- | --- |
| `@` | `A` | `185.199.108.153` |
| `@` | `A` | `185.199.109.153` |
| `@` | `A` | `185.199.110.153` |
| `@` | `A` | `185.199.111.153` |
| `www` | `CNAME` | `mewars.github.io` |

Для IPv6 замените старые apex AAAA-записи на следующие четыре; либо удалите старые AAAA и используйте только A, чтобы IPv6-клиенты не попадали на прежний хостинг:

| Имя | Тип | Значение |
| --- | --- | --- |
| `@` | `AAAA` | `2606:50c0:8000::153` |
| `@` | `AAAA` | `2606:50c0:8001::153` |
| `@` | `AAAA` | `2606:50c0:8002::153` |
| `@` | `AAAA` | `2606:50c0:8003::153` |

Удалите конфликтующие apex ALIAS/ANAME или URL forwarding на Netlify; для `www` уберите старые A/AAAA/CNAME, прежде чем создать указанный CNAME. CNAME указывает на `mewars.github.io`, без имени репозитория или `https://`.
MX, почтовые TXT и другие записи, не относящиеся к переключению apex/www, сохраняйте. NS менять не требуется, если текущий DNS-провайдер позволяет редактировать эти записи. Если DNS обслуживается Netlify, сохраните DNS-зону: менять nameservers для перехода на Pages необязательно.

Источник адресов и правил custom domain / CNAME: [официальная документация GitHub](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## Netlify и существующие функции

Netlify-сайт, его настройки build (`npm run build`, `dist`) и Deploy Preview сохраняются. Проектные Netlify-настройки не удаляются; custom domain/DNS будут переключены отдельно после merge. Для preview используйте Netlify preview URLs.
Настройки Auth, consent, Метрики и Telegram loader не меняются. Workflow передаёт `CONTEXT=production` только при deploy из `mewars`, сохраняя существующее поведение production build; PR получает `deploy-preview`. JavaScript Метрики по-прежнему ограничен origin `https://ryadomcity.ru` и согласием пользователя.
Telegram fix PR #21 сохраняется: в обычном браузере SDK не запрашивается, Mini App загружает его после первого render с timeout/fallback.
При сохранении origin `https://ryadomcity.ru` локальное избранное, cookies и согласия остаются в том же браузерном хранилище.

## Локальная проверка production root

```sh
npm ci
npm run build
npm run lint
npm run test:maps
npm run test:import
CONTEXT=production npm run build:pages
npm run preview -- --mode github-pages
```

Откройте `http://localhost:4173/` (или порт Vite), проверьте `/`, hero, favicon, CSS/JS, `#/places`, профиль, Login, избранное, карты, музыку и обновление hash-маршрутов. Запросов к `/bookish-telegram/assets/...` в этой сборке быть не должно.
Для старого subpath-теста: `npm run build:pages:test` и `npm run preview -- --mode github-pages-test`, затем `/bookish-telegram/`.
