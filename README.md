# 3Dело

Минимальный рабочий каркас сайта студии 3D-печати и вывесок.

## Технологии

- Node.js + Express
- SQLite (better-sqlite3)
- Vanilla HTML/CSS/JS

## Быстрый старт

```bash
npm install
npm run dev
```

После запуска откройте: `http://localhost:3000`

## Что уже есть

- Express-сервер с базовыми маршрутами
- Автоинициализация SQLite в `data/3delo.sqlite`
- Начальные таблицы: `products`, `categories`, `orders`, `order_items`, `calculator_settings`, `admin_users`
- Базовые страницы: `/`, `/catalog`, `/admin` (с входом)

## Переменные окружения

Файл `.env`:

- `PORT` — порт сервера
- `SESSION_SECRET` — секрет сессий
- `DB_PATH` — путь к SQLite-файлу
- `ADMIN_EMAIL` — логин администратора для первичного создания
- `ADMIN_PASSWORD` — пароль администратора для первичного создания

## Загрузка файлов

Подготовлен защищенный endpoint `POST /api/uploads/image` (только для админа):

- принимает только изображения `jpeg/png/webp`
- ограничение размера: 5 MB
