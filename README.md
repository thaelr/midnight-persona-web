# Midnight Persona Web

React / TypeScript / Vite / Motion / Supabase Auth. Локальная интеграционная редакция от 3 ноября 2026 года по финальному ТЗ 01.11.2026 v2. Основа — существующий Midnight Violet frontend из рабочей папки проекта; архив midnight-persona-web-violet(1).zip в переданных файлах отсутствовал. Визуальные токены и исходные assets сохранены; происхождение дизайна — docs/DESIGN_REFERENCE.md.

Frontend использует актуальный Gateway main 77b60cfdf01bbd4663c617ddda09a15584009060 вместе с изменёнными Gateway/SQL/n8n файлами из общего пакета. Это исходники для ручного переноса, без публикации и без выполненных production-изменений.

## Запуск и проверки

Node.js 22+ / pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

TypeScript, 17 тестов транспорта, локализации, OAuth callback и восстановления платежей прошли. Vite production build выполнен. Локальные проверки работают с изолированными фикстурами. Реальные OAuth, Telegram OIDC, IPN и Writer E2E в production не выполнялись. Полные результаты и браузерная QA — в docs/TEST_RESULTS.md общего ZIP.

## Реализованные подключения

- Google/Guest Auth, ручная Google link, серверный приоритет языка, обработка OAuth конфликтов, изоляция состояния по auth identity и бизнес-аккаунту.
- Динамические языки и серверные namespace web/commerce с кешем 60 секунд. При ошибке каталога языков показан повтор, фиктивный enabled-list не записывается. RU/EN словари — localization/; обновление: node scripts/extract-localizations.mjs.
- WelcomeScreen и welcome.css отделены от App без переноса auth/route/consent логики. Галерея персонажа использует произвольный server gallery_photos массив и существующие реальные URL.
- Чаты, optimistic outbox, история, события, continuation, оба reset-режима, server unread, photo/video в общей истории, повторный доступ к видео через исходный delivery ID.
- Server-priced покупки и Full upgrade. Video Unlock восстанавливается по оплаченному video_delivery_id. Выбор Full с фотопанели сохраняет её контекст и после оплаты запрашивает одну идемпотентную выдачу по праву Full. Возврат checkout сам по себе оплату не подтверждает.
- Реальные административные публикации отдельным системным чатом, голосование из активной кампании, имя и profile_text, Telegram linking через официальный OIDC SDK и одноразовый server challenge. При отсутствии данных отображаются пустые состояния.
- Попапы и просмотр медиа поддерживают browser back. Нейтральные QA фикстуры не входят в build и итоговую поставку.

## Конфигурация владельца

public/config.json сохраняет существующий формат. Пустые значения намеренно не заменены выдуманными production-данными.

| Поле | Значение |
| --- | --- |
| apiBaseUrl | Реальный HTTPS origin Gateway, без /web, либо настроенный same-origin путь |
| supabaseUrl / supabasePublishableKey | Существующий Auth project и только publishable/anon key |
| introVideo / ambientVideo | Предоставленные видео либо пустые строки |
| termsUrl / privacyUrl | Реальные юридические документы; без них consent не активируется |
| supportTelegram / supportEmail / faqUrl | Проверенные контакты и ссылки |

Supabase должен разрешать Google OAuth, anonymous sign-in и manual identity linking; redirect URLs должны соответствовать домену frontend. Gateway должен разрешать этот origin для CORS. Для Telegram нужны настройки Telegram Login client/origins на сервере. Цена, entitlement, secret keys, payment provider credentials и n8n URLs никогда не задаются frontend.

Business data идут только через Gateway. Browser Supabase используется исключительно для Auth. Сервис-воркер не кеширует API, авторизацию, платежи и медиа. Все внешние E2E проверяет владелец на настроенном стенде после ручного переноса общего пакета.

