# Контракты и внешние зависимости — 05.11.2026

Это текущий статус поставки v3.1. Исторические списки отсутствующих API от 28 октября и 3 ноября больше не описывают текущий код.

| UI | Реальный контракт Gateway |
| --- | --- |
| Auth / профиль | bootstrap, me, PATCH me, age/terms, Google Auth; Telegram custom Supabase identity проверяется Gateway; legacy linking challenge остаётся серверной операцией |
| Список чатов | GET chats: last_message, unread_count, last_read_message_id, origin; POST read |
| Активный чат | messages: event_cursor + quick_replies; events: cursor + operations для operation_ids; gap 409 требует snapshot/rebase; повтор message/reset использует прежний client_message_id |
| Фото | GET/POST media/:id/panel: position/count, server actions, anchor/current ID; закрытый offer открывается существующим unlock/payment |
| Видео | gallery pending deliveries и history video_delivery_id; повтор GET delivery возвращает ссылку того же владельца без новой выдачи |
| Покупки | Account catalog/entitlements; purchase.chat_code необязателен для subscription; product.requires_chat определяет необходимость контекста; receipt и server status подтверждают право |
| Публикации / голосование | publications с пагинацией; voting campaign/candidates, server vote |
| Локализация | public languages и namespace web/commerce; ошибки дают встроенный RU/EN, не блокируют вход |

Полный snapshot: `contracts/openapi.web.json`; генерация TS: `scripts/generate-api.mjs`. Изменения SQL/n8n и security invariants описывает общий `INTEGRATION_REPORT.md`. Клиент не содержит собственной базы персонажей, медиавыбора, цен, балансов или правил entitlement.

Оставшиеся материалы/внешние зависимости:

- Утверждённые RU/EN Terms и Privacy: четыре поля `src/legal/content.ts`, заполняет владелец.
- Реальный Supabase Telegram custom OIDC provider, email-optional/profile scope и проверяемый allowlisted Telegram `id`; opaque OIDC `sub` не является Telegram bot user ID. Google/Guest/linking и redirect origins должны существовать в Auth.
- Платёжные кабинеты и реальные IPN, приватный Storage/video catalogue, CORS/origins — не проверялись и не изменялись в production.
- Публикации и голосования показывают реальные серверные данные; пустое состояние штатно.

Проверки разделены: unit/контролируемые browser fixtures; локальные реальные Gateway/Postgres и n8n/Core/Writer с нейтральной моделью; непроверенные реальные OAuth, внешние оплаты/IPN, production-медиа, physical mobile keyboard и длительная работа мобильной ОС в фоне. Зелёная локальная сборка не равна production-проверке.
