# Рядом: визуальная система городского гида

Рабочая ветка `codex/visual-redesign` создана от `origin/mewars` (`0e058b4`),
включая merged PR #16 и #17. Новых UI-библиотек, шрифтов/SDK с внешней загрузкой
и чужих фотографий нет. Реальные места и demo-данные каталога не изменены.

## Система

| Token | Light | Dark |
| --- | --- | --- |
| background | #F7F6F2 | #171922 |
| surface | #FFFFFF | #22252F |
| secondary surface | #EEEDE8 | #2B2E39 |
| text | #171821 | #F4F3EF |
| muted | #686A73 | #B1B3BF |
| primary | #5C68DF | #9AA4FF |
| primary soft | #EBEDFF | #2E3249 |
| border | #E2E2DD | #383B46 |

Основной accent слегка темнее ориентировочного светлого сиреневого, чтобы
маленький белый текст на primary-кнопках оставался читаемым. Категории используют
только мягкие blue/coral/violet акценты. Шрифт — системный sans-serif, без запросов
к шрифтовым сервисам. Единая panoramic-обложка: desktop 600–720px, mobile 520px. Название города
100–174px на desktop, адаптивное на mobile, поверх локальной иллюстрации.

`styles.css` теперь содержит импорты отдельных модулей: tokens, base, chrome,
home, cards, catalog, detail, account, overlays. Старые дублирующие правила
`web.css` удалены. Музыкальный плеер и cookie banner сохраняют свои CSS-модули.

## Что изменилось

- Общая `CityHome` для HomePage/WebHomePage: editorial cover, крупный заголовок,
  поиск в hero, фирменная иллюстрация в новой композиции, CTA, быстрые сценарии.
  Mobile перестраивает композицию в вертикальную последовательность, а не
  уменьшает desktop hero. Первая подборка находится сразу после визуальной обложки и chips.
- Быстрые сценарии действительно фильтруют существующие данные: кафе; парки и
  достопримечательности; музеи; события с dateOffset=0; услуги. «С детьми» не
  показан, поскольку надёжного признака в данных нет.
- Подборки: куда сходить (demo), где поесть, места, которые стоит увидеть,
  услуги рядом (demo). Поиск использует прежнюю функцию matches.
- Card: изображение занимает основную площадь, категория/избранное поверх media,
  компактное название и описание до двух строк. Demo помечен на изображении.
  Hover со сдвигом и масштабом только на fine pointers.
- DetailPage: большой cover с названием поверх, текст слева и компактная sticky
  sidebar справа; на mobile отдельный ряд быстрых действий под обложкой.
  Provenance остаётся небольшим блоком под текстом. Контакты и действия:
  маршрут, карта, звонок, безопасные website/VK при наличии, избранное.
- «Ещё рядом» — до трёх реальных записей того же city/kind/основной category,
  с существующим общим favorite state, без recommendation API.
- WebHeader: компактный sticky header; бренд и город слева, навигация по центру,
  музыка/избранное/профиль справа. Mobile/Telegram сохраняют нижнюю навигацию.
- WebFooter теперь общий для desktop/mobile, с навигацией, всеми legal links,
  cookie settings, сотрудничеством/VK и обозначением demo-контента.
- MusicPlayer: компактная floating card, настройки показываются/сворачиваются
  существующим isExpanded. Safe-area и измеренные высоты учитываются при размещении
  плеера, cookie banner и нижней навигации. JS audioPlayer/Radio Record не менялись.
- Profile/login/empty states/city picker согласованы с новыми tokens. CookieBanner
  меняется только стилями. Admin importer остаётся utility interface.

## Медиа

`data/cityCover.ts` — единая конфигурация src/alt/caption для будущей лицензированной
обложки. `MediaImage` поддерживает lazy loading и локальную SVG-заглушку при ошибке;
hero/detail eager. Градиенты cover сохраняют контраст текста поверх будущей фотографии. `PlaceMedia` принимает
массив изображений и умеет раскладывать gallery, хотя текущие данные дают одно изображение.
Внешние фотографии не скачиваются. BrandMark/star-blue.png сохранены.

Item получил optional website/vkUrl для действий при наличии собственных данных;
каталог автоматически не заполнялся. URL проверяются синтаксически, без запросов.
PlaceMap/место назначения/геокодинг не менялись — изменены только подпись «Открыть карту»
и оформление. Адресный fallback из PR #17 сохраняется; embed только с координатами.

## Проверки

- `npm run test:maps`: 10/10.
- `npm run test:import`: 12/12.
- `npm run build`, `npm run lint`, `git diff --check` — успешно.
- Chromium: 320/375/390/430/768/1024/1280/1440/1920, light+dark.
  144 сочетания route/width/theme (home, places, detail, events, services,
  profile, login, importer), без document overflow.
- Поиск на home/в каталоге, настоящие quick filters, категории, даты, empty state,
  гостевое избранное после reload, избранное в related cards и detail, все legal pages,
  PD consent, темы, клавиатура, focus-visible, Escape в city picker, reduced motion.
- OAuth-контракт проверен через stub Supabase: без отдельного PD-согласия вызова нет;
  после согласия сохранены custom:yandex и redirectTo. Реальный вход в аккаунт
  не выполнялся. Также проверен сценарий отсутствующей конфигурации Supabase.
- Плеер: play/pause/mute/volume/раскрытие и скрытие с тестовым media element;
  URL Radio Record и audioPlayer не изменены. Live-эфир не запрашивался.
- На всех ширинах проверены границы плеера/cookie banner/bottom nav с дополнительным
  safe-area 20px: блоки не пересекаются. Cookie consent и управление им работают.
- Telegram SDK contract в browser fixture: compact shell, имя, тема, ready/expand,
  native BackButton. Это проверка layout/контракта, а не запуск в реальном Telegram-клиенте.
- Importer: загрузка/экспорт JSON без запросов. Production-сборка с согласием на
  аналитику: прямой вход и hash navigation отключают Метрику, выход возобновляет её.
- До commit созданы before/after screenshots для desktop 1440 (home/places/real
  detail) и mobile 390 (home/real detail), light+dark. Offscreen lazy images
  загружены перед полными снимками. Дополнительно просмотрены первые экраны.

Auth/Supabase adapters, consent state, PD consent storage, analytics, importer,
useFavorites/useRoute и audioPlayer не изменены. Единственное изменение useTelegram —
значения meta theme-color, соответствующие палитре.

Сборка не получила новых зависимостей; CSS стал меньше, JS остаётся сопоставимым
с исходной сборкой. PR создаётся без merge.

## Переработка композиции в PR #18

Split-screen hero заменён одной визуальной обложкой: слои одного локального
cityCover.src, крупное название, атмосферный градиент, короткий descriptor,
одна CTA и плавающий поиск. Замена cityCover.src на лицензированную фотографию
не требует изменения разметки. Чужие фотографии не загружались.

Header главной накладывается на cover (desktop остаётся sticky); быстрые сценарии
компактные. Афиша и услуги используют четыре существующие карточки, кафе — три
существующих записи; подборка мест — крупная карточка и три меньших.
Изображения доминируют в карточках, категория и избранное поверх media.

Detail: обложка 480–600px с названием поверх, компактные описание/контакты ниже.
На mobile — cover, горизонтальный ряд действий (в том числе ссылки маршрута
из существующего placeMapLinks), описание, контакты, «Ещё рядом». Map-компонент
и его загрузка не изменены, дополнительная встроенная карта не создаётся.

Перед commit сняты home/detail 1440 и 390, light/dark (8 обязательных screenshots).
Повторены 22 unit-проверки, lint/build/diff-check и браузерная проверка девяти
ширин в двух темах; без document overflow и page errors.
