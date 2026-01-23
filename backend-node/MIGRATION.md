# Миграция на Node.js

## Текущий статус

✅ **Создан Node.js бэкенд** на порту **8001**
✅ Legacy бэкенд удалён из репозитория

## Что реализовано

### ✅ Готово
- Базовая структура проекта (Express + TypeScript)
- Подключение к БД через Prisma
- Auth эндпоинты:
  - `POST /api/auth/register` - регистрация
  - `POST /api/auth/login` - вход
  - `POST /api/auth/refresh` - обновление токена
- Health checks:
  - `GET /api/health` - полная проверка (БД, Redis)
  - `GET /api/health/ping` - простая проверка
- Bots эндпоинты:
  - `GET /api/bots` - список ботов
  - `GET /api/bots/:botId` - информация о боте
  - `POST /api/bots` - создать бота
  - `PUT /api/bots/:botId` - обновить бота
  - `DELETE /api/bots/:botId` - удалить бота
  - `POST /api/bots/:botId/start` - запустить бота
  - `POST /api/bots/:botId/stop` - остановить бота
  - `GET /api/bots/:botId/users` - список пользователей бота
  - `POST /api/bots/:botId/users/:userId/block` - заблокировать/разблокировать пользователя
- Triggers эндпоинты:
  - `GET /api/bots/:botId/triggers` - список триггеров
  - `GET /api/bots/:botId/triggers/:triggerId` - информация о триггере
  - `POST /api/bots/:botId/triggers` - создать триггер
  - `PUT /api/bots/:botId/triggers/:triggerId` - обновить триггер
  - `DELETE /api/bots/:botId/triggers/:triggerId` - удалить триггер
- Message Templates эндпоинты:
  - `GET /api/bots/:botId/templates` - список шаблонов
  - `GET /api/bots/:botId/templates/:templateId` - информация о шаблоне
  - `POST /api/bots/:botId/templates` - создать шаблон
  - `PUT /api/bots/:botId/templates/:templateId` - обновить шаблон
  - `DELETE /api/bots/:botId/templates/:templateId` - удалить шаблон
- User Tags эндпоинты:
  - `GET /api/bots/:botId/tags` - список тегов
  - `POST /api/bots/:botId/tags` - создать тег
  - `PUT /api/bots/:botId/tags/:tagId` - обновить тег
  - `DELETE /api/bots/:botId/tags/:tagId` - удалить тег
  - `POST /api/bots/:botId/tags/:tagId/assign` - назначить тег пользователям
  - `POST /api/bots/:botId/tags/users/:userId/assign` - назначить теги пользователю
- Broadcasts эндпоинты:
  - `GET /api/broadcasts` - список рассылок
  - `GET /api/broadcasts/:broadcastId` - информация о рассылке
  - `POST /api/broadcasts` - создать рассылку (с загрузкой файлов)
  - `POST /api/broadcasts/:broadcastId/cancel` - отменить рассылку
  - `DELETE /api/broadcasts/:broadcastId` - удалить рассылку
- Analytics эндпоинты:
  - `GET /api/analytics/overview` - общая аналитика
  - `GET /api/analytics/bots/:botId/stats` - статистика по боту
  - `GET /api/analytics/bots/:botId/funnel` - воронка конверсии
  - `GET /api/analytics/bots/comparison` - сравнение ботов
- Global эндпоинты:
  - `GET /api/tags` - все теги (с фильтром по боту)
  - `GET /api/triggers` - все триггеры (с фильтром по боту)
  - `GET /api/templates` - все шаблоны (с фильтром по боту)
  - `GET /api/users` - все пользователи (с фильтрами)

### ✅ Полностью готово
- Интеграция с Telegram (grammy)
- Очереди для асинхронной отправки рассылок (BullMQ)
- Workers для обработки рассылок
- Обработка триггеров
- Обработка шаблонов сообщений
- Автозапуск ботов при старте сервера
- Обработка событий каналов (присоединение/отписка)

## Запуск

### Через Docker Compose
```bash
docker compose up backend-node
```

### Локально
```bash
cd backend-node
npm install
npx prisma generate
npm run dev
```

## Переменные окружения

Node.js бэкенд использует переменные из `.env`:
- `DATABASE_URL`
- `REDIS_URL`
- `SECRET_KEY`
- `CORS_ORIGINS`

## План миграции

1. ✅ Базовая структура и auth
2. ✅ Эндпоинты для ботов
3. ✅ Эндпоинты для рассылок
4. ✅ Эндпоинты для триггеров
5. ✅ Эндпоинты для тегов и шаблонов
6. ✅ Аналитика
7. ✅ Global эндпоинты
8. ✅ Интеграция с Telegram (grammy)
9. ✅ Очереди для асинхронной отправки рассылок (BullMQ)
10. ✅ Workers для обработки рассылок
11. ✅ Обработка триггеров
12. ✅ Обработка шаблонов сообщений
13. ✅ Автозапуск ботов при старте сервера

## Статус миграции: ✅ ЗАВЕРШЕНА

Node.js бэкенд полностью готов к использованию.

Репозиторий больше не содержит legacy бэкенд.
