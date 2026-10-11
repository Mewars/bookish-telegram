# Ручная сборка ZIP для Спринтхост

Workflow: `.github/workflows/sprinthost-build.yml`, **Build Sprinthost ZIP**.
Он запускается только вручную (`workflow_dispatch`), использует Node.js 24, `npm ci`, проверки и `npm run build` с существующим base `/`.
Ни один шаг не подключается к Спринтхост и не публикует сайт. GitHub Pages, DNS, Supabase и настройки авторизации не изменяются.

## Как получить ZIP

После согласованного merge этого PR в основную ветку `mewars`:

1. Откройте репозиторий **Mewars/bookish-telegram → Actions**.
2. Слева выберите **Build Sprinthost ZIP**.
3. Нажмите **Run workflow**. В **Use workflow from** выберите `mewars`, затем **Run workflow**.
4. Откройте созданный запуск и дождитесь зелёного статуса job `build-zip`.
5. Внизу страницы запуска, в **Artifacts**, нажмите **sprinthost-site**. Для скачивания нужен вход в GitHub и доступ к репозиторию.
6. GitHub скачивает внешний ZIP-контейнер артефакта. Распакуйте его: внутри находится **sprinthost-site.zip**.
7. Откройте `sprinthost-site.zip`. В его корне должны быть `index.html`, `assets/`, `brand/` и остальные файлы сборки. Дополнительной папки `dist/` нет.

Артефакт хранится 14 дней (либо меньше, если ограничения репозитория/организации требуют этого). При истечении срока запустите workflow снова.
До merge новый ручной workflow может не отображаться в Actions: GitHub регистрирует `workflow_dispatch` из default branch (`mewars`). Автоматический merge в рамках этой задачи не выполняется.

## Переменные сборки и состав архива

Используются существующие repository secrets в **Settings → Secrets and variables → Actions**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — существующий публичный browser key `sb_publishable_…`.

Не нужен Яндекс Maps API key: используется OpenStreetMap. Workflow проверяет наличие корректных публичных параметров, не печатая их значения; при отсутствии сборка останавливается, чтобы не выдавать ZIP с отключённым Auth.
Публичный Supabase URL и publishable key предусмотрены для клиентского приложения и встраиваются Vite в JS. Они не являются серверными секретными ключами. Service-role/secret key, OAuth secret и Bot Token не запрашиваются и не добавляются.

Архив создаётся только из содержимого `dist/`. Исходники приложения, `.env`, `node_modules`, `.git` и source maps не включаются. Workflow проверяет ZIP layout, root paths и целостность архива перед загрузкой.

## Размещение вручную

Целевая папка: `/home/mewars/domains/mewars.xsph.ru/public_html/`.

Когда решите публиковать сборку, отдельно сохраните резервную копию текущих файлов. Загрузите **содержимое** `sprinthost-site.zip` в эту папку либо загрузите ZIP и распакуйте там через файловый менеджер Спринтхост.
Итоговый путь к главной: `/home/mewars/domains/mewars.xsph.ru/public_html/index.html`, а не `public_html/dist/index.html`.
Проверьте `/`, загрузку `/assets/...` и `/brand/yeniseysk-hero-final.jpg`, hash-навигацию `/#/places` и `/#/profile` на компьютере и телефоне.
Для текущей hash-навигации дополнительные SPA rewrite-правила не нужны.
Сам ZIP после распаковки можно убрать из публичной папки.

Сборка сохраняет текущую логику Auth и Метрики. Если проверяете вход на `mewars.xsph.ru`, разрешённые redirect URL определяются существующими настройками Supabase; этот workflow их не добавляет и не меняет. Production-домен и его callback URL также не изменяются.
