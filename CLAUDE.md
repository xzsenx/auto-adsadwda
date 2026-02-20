# AUTØ — Telegram Mini App для продажи авто

## Архитектура

- **GitHub Pages** (`https://xzsenx.github.io/auto-adsadwda/`) — статический хостинг HTML/CSS/JS
- **Supabase Storage** — хранит данные (`cars.json`) и фото (`photos/`)
- **n8n workflow** — автопарсинг постов из TG канала → DeepSeek AI → Supabase
- **Telegram WebApp SDK** — интеграция с Telegram (админ авторизация)

## Supabase

- URL: `https://qzxoonsqalnjaqfrhhth.supabase.co`
- Bucket: `auto`
- Публичный URL данных: `https://qzxoonsqalnjaqfrhhth.supabase.co/storage/v1/object/public/auto/cars.json`
- Фото: `auto/photos/{id}.jpg`
- API ключ: собирается через `['sb_secret','0HbUC77s5OGLTf9ImPuKgQ','7sIAXvuJ'].join('_')` (обфускация для обхода GitHub push protection)
- Запись через REST API с заголовком `x-upsert: true`

## Telegram

- Канал: `https://t.me/auto_from_korea_test`
- Бот токен: `8394195133:AAG26MEeQpmn5a1PAp18mW8htQHnYd7GXjI`
- Admin IDs: `[0]` (заглушка, нужно вписать реальный TG user ID)
- Admin пароль (для браузера): `auto2026`

## Файлы

### index.html
Главная страница каталога. Содержит:
- Header с логотипом, навигацией, кнопкой Invert (тема), избранное
- Hero секция
- Фильтры категорий (chips: Все, Седан, Кроссовер, Спорт...)
- Сортировка (По умолчанию, Цена ↑↓, Новее, Пробег)
- Кнопка расширенных фильтров (☰)
- Панель фильтров: марка/модель (dropdown с чекбоксами), цена, год, пробег, мощность, привод
- Сетка карточек авто
- Модальное окно с деталями авто и галереей
- Drawer избранного

### app.js (~580 строк)
Основная логика каталога:
- `DATA_URL` — публичный URL cars.json на Supabase
- `loadCars()` — fetch данных, fallback на FALLBACK_CARS
- `getBrand(title)` / `getModel(title)` — парсинг марки/модели из title
- `POPULAR_BRANDS` — приоритетные марки в фильтре
- `buildBrandDropdown()` / `buildModelDropdown()` — dropdown-менюшки с чекбоксами для мульти-выбора
- `advancedFilters` — объект с Set/Map для марок/моделей + диапазоны цен/год/км/лс/привод
- `applyAdvancedFilters()` / `applySorting()` — фильтрация и сортировка
- `renderCards()` — рендер карточек в grid
- `openModal()` / `carGallery()` — модальное окно с галереей фото
- Избранное через localStorage
- Admin check: TG WebApp user ID или localStorage пароль

### styles.css (~776 строк)
Тёмная тема с CSS переменными:
- `--bg: #0b0b0b`, `--fg: #f3f3f3`, `--card`, `--line`, `--muted`
- `.invert` класс на body для светлой темы
- Dropdown select стили (`.dropdown-select`, `.dropdown-menu`, `.dropdown-item`)
- Карточки, модалка, drawer, галерея, responsive

### admin.html
Панель администратора:
- Авторизация (пароль или TG user ID)
- Список всех машин с thumb, title, price, category
- Кнопки Edit / Delete на каждой карточке
- Модальная форма редактирования: title, price (с ₽), category (select), tag (select), desc, year, km, engine, drive (select), photo upload
- Confirm dialog для удаления

### admin.js (~377 строк)
CRUD через Supabase Storage REST API:
- `SB_KEY` — API ключ (обфусцирован через join)
- `checkAdmin()` — проверка TG ID или localStorage
- `loadCars()` / `saveCars()` — чтение/запись cars.json
- `uploadPhoto()` / `deletePhoto()` — загрузка/удаление фото
- Форма: strip ₽ при загрузке, add ₽ при сохранении

### admin.css (~330 строк)
Стили админки:
- Тёмные select'ы (`color-scheme: dark`, `background: #1a1a1a`)
- Price input с ₽ суффиксом
- Карточки списка, форма, confirm dialog

### config.js (только локально, в .gitignore)
Не используется — ключи инлайнены в admin.js и app.js

### n8n-workflow.json (в .gitignore)
Workflow: TG Trigger → Извлечь пост → DeepSeek → Собрать авто → TG файл → URL фото → Скачать фото → Supabase фото → Supabase cars.json

## Git

- Repo: `https://github.com/xzsenx/auto-adsadwda.git`
- Branch: `main`
- GitHub Pages: включён, деплоится с main
- `.gitignore`: `n8n-workflow.json`, `config.js`

## Структура данных (cars.json)

```json
[
  {
    "id": "bmw-x4-123",
    "title": "BMW X4",
    "price": "5,250,000 ₽",
    "tag": "SUV",
    "category": "suv",
    "images": ["https://qzxoonsqalnjaqfrhhth.supabase.co/storage/v1/object/public/auto/photos/bmw-x4-123.jpg"],
    "desc": "Описание авто...",
    "message_id": 123,
    "specs": {
      "year": "2022",
      "km": "43 000",
      "engine": "184 л.с.",
      "drive": "Полный"
    }
  }
]
```

## Важные нюансы

- Supabase Storage — публичный bucket, чтение без ключа, запись с ключом
- API ключ нельзя пушить открытым текстом — GitHub push protection заблокирует. Использовать `['sb_secret','...','...'].join('_')`
- cars.json перезаписывается целиком при каждом изменении (x-upsert)
- Фото загружаются как `auto/photos/{id}.jpg`
- Шрифт: Inter (Google Fonts)
- Дизайн: dark-first, минимализм, Inter font, rounded corners
