# Midnight Persona Web

Локальная интеграционная редакция по ТЗ v3.1 от 05.11.2026. Основа — проверенный `thaelr/midnight-persona-web` main `85edc2ca5cb39bb0f8db617b3f8967f9b986ac1d`. Astra использован справочно; текущие assets, визуальный стиль и публичные настройки main сохранены. Деплой, push, реальные OAuth и платежи не выполнялись.

## Запуск и проверка

Node.js 22+ и pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm api:check
pnpm test
pnpm build
pnpm test:e2e
pnpm dev
```

Для первого запуска браузерных тестов нужен локальный Chromium: `pnpm exec playwright install chromium`. Playwright использует локальный preview на 127.0.0.1:5177. Обычный набор: **22/22 unit**, **18/18 browser** (17 контролируемых HTTP fixtures + реальный lifecycle Service Worker в двух вкладках), **4 opt-in интеграционных теста пропущены**. Отдельно основной исполнитель проверил 3/3 Web→тестовый Gateway/Postgres и 1/1 Web→Gateway/Postgres/n8n/Core/Writer с нейтральным ответом модели. Эти результаты не подтверждают production OAuth, IPN, Storage или живую модель. Integration fixtures требуют свежих изолированных данных; не направлять их на production. Команды и логи — в общем `INTEGRATION_REPORT.md` и `verification/` поставки.

## Архитектура

- Supabase используется браузером только для Auth: Telegram custom provider через обычный PKCE OAuth, Google, Guest и linking. Проверка Telegram claims, привязка и перенос аккаунта принадлежат Gateway/SQL. Ошибка bootstrap показывает retry/logout, без повторной регистрации.
- TanStack Query v5 хранит серверные данные под ключами API origin + владелец + язык + контекст. На logout/смене пользователя запросы отменяются, приватный cache очищается. Каталог, публикации, Commerce и локализация имеют независимые ошибки. При сбое локализации доступны встроенные RU/EN.
- `/web/chats` возвращает компактные previews/unread/origin. История и последовательный polling событий существуют только для открытого чата. Hidden/offline приостанавливают polling; transient ошибки дают bounded backoff. Snapshot `event_cursor` и состояние операций восстанавливают cursor gap без новых message/reset ID.
- Outbox, cursor и receipt IDs сохраняются для восстановления. История ограничена окном 1000 сообщений; старые страницы доступны с возвратом к последним. Завершённые операции, уведомления и Query caches ограничены; pending операции не удаляются ради лимита.
- Фотопанели используют серверные `position/count`, anchor/current IDs, prev/next/regen и существующий unlock. Закрытое предложение не раскрывает URL. Видео получает новую ссылку по тому же delivery ID. Повторное Full-восстановление сохраняет ID; устаревшая панель завершает animation intent понятным сообщением.
- Подписку можно купить без чатов. Цены и права приходят только с сервера. Web Locks необязателен; сохранённый ID и серверная идемпотентность защищают повторы и две вкладки. Возврат checkout не подтверждает оплату.
- ErrorBoundary изолирует экраны/оверлеи. Диагностика содержит только allowlisted code/status/operation/request_id, без токенов, текста чата и payload.
- Chat/Profile/Purchase загружаются отдельно. Текущие цвета и размеры вынесены в `src/tokens.css`; редизайна нет. Фоновое ambient-видео начинается после intro.
- PWA ждёт не менее 60 минут именно в фоне. Обновление согласуется всеми вкладками после восстановления identity/drafts и только в безопасный момент; активное видео, черновики и операции откладывают его. API, config, Auth, платежи и приватные медиа не кешируются сервис-воркером.

## API и локализация

Канонический OpenAPI находится в Gateway `docs/openapi.web.json`; его snapshot — `contracts/openapi.web.json`, сгенерированные типы — `src/lib/generated-api.d.ts`. Обновление из локального Gateway:

```sh
node scripts/generate-api.mjs --source ../gateway/docs/openapi.web.json
pnpm api:check
```

Критичные ответы Auth/Commerce/events дополнительно проверяются в runtime. `tests/openapi.test.ts` проверяет воспроизводимость типов и, если Gateway расположен рядом, совпадение snapshot с ним.

RU/EN dictionaries: `localization/{ru,en}/{web,commerce}.json`; генератор `node scripts/extract-localizations.mjs`. По каждому языку: web 231 строка, commerce 44 верхнеуровневых ключа / 57 строковых листьев, включая семь semantic product types. Database-пакет импортирует их отдельной новой миграцией с сохранением посторонних ключей.

## Материалы владельца

Готовы публичные `/terms?lang=ru|en` и `/privacy?lang=ru|en`, без зависимости от Auth/Gateway. Владелец вставляет утверждённые тексты в **`src/legal/content.ts`**: `legalContent.terms.ru`, `.terms.en`, `.privacy.ru`, `.privacy.en`. Пока они пусты, страница честно сообщает об отсутствии текста; новый consent не подтверждается. Юридические тексты не придуманы.

В `public/config.json` сохранены текущие реальные публичные значения main; изменены только `termsUrl`, `privacyUrl` и добавлен пустой `telegramAuthProvider`. Значение провайдера должно соответствовать существующему Supabase custom provider (`custom:...`). Без него Telegram-кнопка показывает отсутствие подключения. Фактические настройки Google/Guest/Telegram Auth, redirect origins, allowlisted Telegram claims, платежных провайдеров, Gateway CORS и приватного Storage — внешние зависимости, их кабинеты здесь не менялись. Секреты в frontend не добавляются.
