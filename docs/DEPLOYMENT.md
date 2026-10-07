# Публикация и проверки

Исходники public, сборка dist. Runtime — обычные статические файлы, без Node.js и секретов в браузере.

В приватном репозитории bibanin23-cloud/syntonik-krasnodar-site выберите Settings → Pages → Source → GitHub Actions. Для Pages из приватного репозитория нужен подходящий тариф GitHub. Репозиторий не делать публичным без отдельного согласования. Custom domain пока пустой.

Workflow `.github/workflows/pages.yml` проверяет код и пути, устанавливает только для CI sharp 0.35.5 и Playwright 1.56.1, готовит lossless WebP, проверяет Chromium на 1920/1440/1366/1024/768/390/375/360, публикует dist и повторяет проверки на опубликованном URL. Артефакты: build-browser-check и published-browser-check, скриншоты и JSON. Автоматические проверки геометрии не заменяют визуальную приёмку композиции.

Временный адрес: https://bibanin23-cloud.github.io/syntonik-krasnodar-site/ . Наличие этой ссылки не подтверждает успешную публикацию: нужен успешный deploy. До переноса: noindex,nofollow и запрет обхода. Canonical ориентирован на https://syntonik-krasnodar.ru/ . После настройки именно этого custom domain сборка использует корень и открывает индексацию главной. Блог-заглушка и юридические страницы остаются noindex.

## Формы

Существующий public/lead-config.js содержит только публичный Web App /exec. Apps Script не меняется. ID таблицы и Telegram, токены — в Script Properties. MAX_ENABLED=false; личная ссылка MAX сохранена.

Обычные тесты форм подменяют ответ и не создают заявки. Один настоящий тест: Run workflow с test_real_lead=true либо commit с явной отметкой [real-lead-test]. Он подписан «ТЕСТ сайта — не перезванивать», использует телефон дилера, создаёт строку в Таблице и сообщение в Telegram. Повтор того же workflow использует прежний request_id. Ответ обработчика подтверждает сохранение и статусы каналов; наличие строки и сообщения окончательно проверяется в Таблице и Telegram.

## Ручная сборка

`npm run build` создаёт закрытый от индексации предпросмотр в корне. Для оптимизации установите sharp указанной версии как инструмент разработки и задайте OPTIMIZE_IMAGES=true. Для временного URL: BASE_PATH=/syntonik-krasnodar-site, SITE_URL=https://bibanin23-cloud.github.io/syntonik-krasnodar-site/ . Для основного домена: пустой BASE_PATH, SITE_URL=https://syntonik-krasnodar.ru/, INDEXABLE=true. Изображения public не меняются.

RUTUBE, инструкция и юридические тексты подключены. Блог остаётся заглушкой. Домен, REG.RU и Tilda менять только по отдельной команде: [инструкция](../DOMAIN-MIGRATION.md).

