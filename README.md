# Syntonik Краснодар

11 утверждённых экранов на HTML/CSS/JavaScript, без внешних runtime-зависимостей. Подключены 20 фотографий продукции, шесть RUTUBE-кейсов, FAQ из 30 ответов в четырёх категориях, PDF, инструкция и пять юридических страниц. Блог пока без статей.

Node.js 22+. `npm start` — предпросмотр; `npm test` — формулы, формы и production-пути; `npm run check` — синтаксис и ресурсы; `npm run build` — статическая сборка dist. В ограниченной среде: `node --test --test-isolation=none tests/*.test.mjs`.

Исходники public не перезаписываются сборкой. Workflow Pages автоматически задаёт base path, сжимает PNG в lossless WebP и проверяет восемь размеров экрана до и после публикации. Скриншоты и JSON-отчёты доступны в артефактах Actions. Инструменты сборки не нужны посетителям.

Формы используют существующий Apps Script: Google Таблица + Telegram. MAX для заявок выключен в Script Properties; личная ссылка MAX сохранена. Токены во frontend отсутствуют. Временная версия закрыта от индексации.

[Публикация и проверки](docs/DEPLOYMENT.md) · [Перенос домена](DOMAIN-MIGRATION.md) · [ТЗ](docs/TECHNICAL-SPEC.md). DNS и Tilda до отдельной команды не менять.
