# РЯДОМ — проверка и продолжение 16.10.2026

Исходный HEAD `mewars`: `b766641345963ba20f80f4a7bc29ace14ba6ec39`.
PR #119 действительно объединён; Sprinthost [38923418565](https://github.com/Mewars/bookish-telegram/actions/runs/38923418565) и browser QA [38923576084](https://github.com/Mewars/bookish-telegram/actions/runs/38923576084) SUCCESS.
Прочитаны Issues #80/#85/#88/#89/#98/#101 и последние комментарии #80.
Старые открытые PR #24/#48 не затрагивались.

## Проверенные изменения

- [PR #120](https://github.com/Mewars/bookish-telegram/pull/120) объединён: `4ff887f8dc589827a9a8e3107ec4c55db38bfc16`. Исходный коммит `93b2b550af025de5d7366055b18eba75926a3903`. Все найденные JS entry/modulepreload/literal dependency chunks проходят anonymous/authenticated, MIME и production/secret проверки. 33 HTTP mock tests PASS; добавлены в npm test. Вычисляемые URL и orphan files не покрываются обходом; dist проверяет отдельный существующий аудит.
- CI #120: [unit 38925485773](https://github.com/Mewars/bookish-telegram/actions/runs/38925485773), [beta smoke 38925486029](https://github.com/Mewars/bookish-telegram/actions/runs/38925486029), [full build 38925485823](https://github.com/Mewars/bookish-telegram/actions/runs/38925485823) SUCCESS. Sprinthost [38925691808](https://github.com/Mewars/bookish-telegram/actions/runs/38925691808) и Pages [38925691911](https://github.com/Mewars/bookish-telegram/actions/runs/38925691911) SUCCESS; новый browser QA 38925888076 ещё выполнялся при записи.
- [PR #121](https://github.com/Mewars/bookish-telegram/pull/121): коммит кода `aba075203ac79fb14abe4c16257f94cd6e2cf987`, валидация пустого города, типа сделки, runtime типов текста до create/update; город trim перед insert. 9 новых тестов PASS. Список городов не захардкожен: существующие FK/RLS проверяют доступность города. API payload не принимает author/status/role.
- CI кода #121: [full build 38925800253](https://github.com/Mewars/bookish-telegram/actions/runs/38925800253), [beta smoke 38925800228](https://github.com/Mewars/bookish-telegram/actions/runs/38925800228) SUCCESS. После добавления этого handoff нужно повторно дождаться проверок текущего HEAD; merge/deploy сверять по GitHub, не предполагать по этой записи.
- Локально npm ci из lockfile, npm test, lint и tsc/Vite build PASS. Первая baseline попытка выявила отсутствующий PGlite в старом node_modules; после npm ci регрессия прошла. Общая регрессия после rebase на #120 также PASS.

## Матрица фактической реализации

| Возможность | Факт / исходники | Проверка и следующий пробел |
|---|---|---|
| Закрытая бета | scripts/*closed-beta*, test-only backend gate | Unit/dist/HTTP mocks; живой защищённый host не подтверждён |
| Объявления | classifieds/repository.ts, ClassifiedsPage.tsx, SQL private-messaging-v1 | Unit/PGlite RLS; живой A/B/C E2E не выполнен |
| Городская выборка | getPublished/getMine/getPending | City scope tests; выдача объявлений ограничена 100, полноценные поиск/пагинация требуют доработки |
| Фото | photos.ts, ClassifiedPhotoGallery.tsx, private bucket | Storage/RLS mocks + PGlite; проверить частичную пакетную загрузку/повтор и истечение signed URLs |
| Чаты | conversations/messages/read tables, cursor history | RLS/cursor tests; ручное обновление и unread polling, живой E2E не выполнен |
| Модерация/жалобы | review_classified / review_classified_report, UI | Локальные RLS tests; живые роли разных городов и UX причин отказа требуют проверки |
| Городская лента | community/ UI/repository, posts/comments SQL | Unit/PGlite; публичная приёмка отсутствует |
| Погода | weather/metNorway.ts, 5 parser tests из #119 | Только parser; найденный код ещё не подключает UI/server proxy/cache |
| VK новости | Импорт не подтверждён; OAuth bridge решает другую задачу | Нужны группа/права API; существующий OAuth не менять |
| iOS/Android | docs/native-mobile-readiness.md | Нативные проекты/сборки не подтверждены; текущий веб-билд не является native тестом |
| Друзья на карте | Реализация не подтверждена | После privacy gate; opt-in, без координат по умолчанию |
| Каталог/мультигород | organizations/admin, city directory/access | Существующие unit/RLS; полнота карточек, кабинет партнёра и нагрузка не переаттестованы |
| Auth / доступ РФ / ПД | Открытые #88/#98/#101 | Production не менять; реальная сеть РФ и юридическая оценка не выполнены |

## Read-only проверка Ryadom-Test

`djqhixvlfsbvannoqdjw`: ACTIVE_HEALTHY, eu-west-1. SQL JSON-query подтвердил RLS + FORCE RLS у девяти таблиц:
classifieds, classified_messages, classified_conversations, classified_conversation_reads,
classified_reports, classified_user_blocks, classified_photos, community_posts, community_comments.
Bucket ryadom-classified-photos: public=false, 2097152 bytes, MIME WebP/JPEG. auth.users=0.

Флаги RLS не доказывают правильность всех политик. Пользовательские строки не читались;
схемы/Auth/Storage не изменялись. Локальные PGlite данные синтетические.
Живой multi-user/browser E2E не выполнялся: отдельный HTTPS beta-host, test email/Auth
и юридическое основание для реальных данных пока не подтверждены. Production DB не менялась.

## Автоматизация и ограничения

Через automations.peek проверена включённая «Разработка „РЯДОМ“ до приёмки»,
ID 6acfbcd9a6d48191b92c743d1a526ff4, HOURLY, Asia/Krasnoyarsk.
Последний зарегистрированный запуск 2026-10-16T15:06:53Z (22:06 Красноярск),
next_run_time отсутствует. Дубликаты не создавались, другие задачи не менялись.
Это существующая ChatGPT-автоматизация; бесконечный Codex Cloud процесс не запускался.

Branch protection API вернул HTTP 403 Resource not accessible by integration;
конфигурация не установлена. Административный обход не применялся.
Supabase changelog заблокирован сетевой политикой (CONNECT 403); справка RLS получена
через Supabase search_docs. Никаких изменений Supabase SDK/схем в этих PR нет.

## Следующий безопасный шаг

Перепроверить свежие HEAD/PR/CI/deploy, затем #80: повтор после частичной пакетной
загрузки фото. Сейчас после сбоя selected сохраняет весь список, включая уже успешно
загруженные файлы; повтор может продублировать подтверждённый префикс. Исправить с
тестами ошибок подготовки, загрузки, cleanup и повторной попытки. Не ослаблять RLS.
Далее реальный A/B/C E2E только на изолированной разрешённой инфраструктуре.
Публичный релиз и окончательная приёмка не выполнены.
