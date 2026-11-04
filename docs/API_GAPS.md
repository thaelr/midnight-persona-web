# Статус контрактов на 3 ноября 2026 года

Этот файл заменяет исторический список отсутствующих endpoints ветки web от 28 октября. Источник истины для поставки — актуальный Gateway main 77b60cfdf01bbd4663c617ddda09a15584009060 и полные изменённые файлы в общем ZIP.

Реализованы: локализованные персонажи и gallery_photos; динамические /web/localizations; profile_text; reset.scene_mode; history фото/видео с устойчивыми ID и client_message_id; бессрочный повторный доступ владельца к доставленному видео; Video Unlock/VideoPass/Full/upgrade; providerless бесплатные действия; EN NOWPayments и RU СБП; chat summaries/read; реальные publications; campaign voting; Telegram OIDC linking.

Сведения об endpoint/DTO/SQL/n8n связях находятся в docs/CONTRACT_MATRIX.md общего ZIP. Порядок новых миграций и словарей — в docs/INTEGRATION_NOTES.md.

Внешние зависимости, которые frontend не подменяет:

- Реальный Gateway origin и разрешённый frontend CORS origin.
- Supabase Auth URL, publishable key, Google/Anonymous/manual linking и callback allowlist.
- Реальные Terms/Privacy, контакты и FAQ.
- Настройки Telegram Login client/origin; SDK загружается с официального oauth.telegram.org только при открытии привязки.
- Серверная конфигурация SKU/цен/провайдеров и реальная подтверждённая IPN интеграция.
- Готовые video_catalog/MP4 и доступ Gateway к приватному Storage.
- Административные публикации и активная campaign/candidates. Отсутствие этих данных является штатным пустым состоянием.

Скрытые Writer/Memory/Build Dynamic Instructions workflow не реконструировались. Полный E2E с реальной генерацией, внешним OAuth/Telegram/payment и физической мобильной клавиатурой остаётся проверкой владельца. Успешная локальная сборка не доказывает эти сценарии.

Фотопанели: GET/POST /web/chats/:chat_code/media/:media_id/panel используют существующие Media Commerce photo_prev/photo_next/photo_regen. Только сервер выбирает и оценивает новое фото; frontend сохраняет anchor/current ID и идемпотентность, а locked offer открывается через прежний unlock/payment. Lightbox листает только уже полученные авторизованные фото, без запросов новых медиа.

