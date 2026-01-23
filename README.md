# GateGram 🚀

> Профессиональная SaaS платформа для управления Telegram ботами, автоматизации рассылок и отслеживания трафика

[![Node.js](https://img.shields.io/badge/Node.js-API-green.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-blue.svg)](https://www.prisma.io/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

GateGram — это комплексная платформа для управления Telegram ботами с мощными инструментами автоматизации, аналитики и маршрутизации трафика.

## ✨ Ключевые возможности

- 🤖 **Управление множеством ботов** — создавайте и управляйте неограниченным количеством Telegram ботов
- 📨 **Умные рассылки** — массовые рассылки с медиа, планированием и фильтрацией аудитории
- ⚡ **Триггеры и автоматизация** — настраивайте автоматические действия на события пользователей
- 🏷️ **Сегментация пользователей** — теги, фильтры и источники трафика для точного таргетинга
- 📊 **Аналитика в реальном времени** — отслеживайте конверсии, активность и эффективность рассылок
- 🔗 **Реферальные ссылки** — генерируйте уникальные ссылки и отслеживайте источники трафика
- 📝 **Шаблоны сообщений** — создавайте переиспользуемые шаблоны с динамическими переменными
- 🎨 **Современный UI** — адаптивный интерфейс с поддержкой мобильных устройств

## Описание

GateGram — это комплексная платформа для управления Telegram ботами, которая позволяет:

### Основной функционал

#### 1. Управление ботами
- Создание и настройка множества Telegram ботов
- Автоматический запуск/остановка ботов
- Настройка приветственных сообщений с поддержкой переменных
- Отслеживание статуса ботов (активен/неактивен)
- Реферальные ссылки с отслеживанием источников трафика
- Статистика по источникам (конверсия, активные пользователи)

#### 2. Рассылки
- **Массовые рассылки** с поддержкой медиа-файлов:
  - Фото (одно или несколько)
  - Видео
  - Аудио
  - Документы
  - Медиа-группы (до 10 файлов)
- **Планирование рассылок** на определенное время
- **Фильтрация аудитории**:
  - По статусу (активные/заблокированные)
  - По тегам (включение/исключение)
  - По источникам трафика
- **Использование шаблонов** для рассылок
- **Отслеживание прогресса** в реальном времени
- **Статистика**: отправлено/не доставлено сообщений
- Автоматическая очистка медиа-файлов после рассылки

#### 3. Триггеры (Автоматизация)
- **Типы событий**:
  - Регистрация нового пользователя
  - Неактивность пользователя (настраиваемый период: 1-4+ недели)
  - Присоединение к каналу
  - Отписка от канала
- **Множественные действия** на одно событие:
  - Отправка сообщения (текст или шаблон)
  - Добавление тега
  - Удаление тега
- **Условия срабатывания**:
  - Период неактивности (для триггера "неактивный пользователь")
  - Источник трафика
  - Наличие/отсутствие тегов

#### 4. Шаблоны сообщений
- Создание переиспользуемых шаблонов
- **Поддержка переменных**:
  - `{{ user_name }}` — имя пользователя
  - `{{ user_id }}` — ID пользователя
  - `{{ bot_name }}` — имя бота
  - `{{ status }}` — статус пользователя
- Использование в рассылках и триггерах
- Группировка по ботам

#### 5. Теги пользователей
- Создание и управление тегами
- Массовое назначение/снятие тегов
- Фильтрация пользователей по тегам
- Использование в рассылках и триггерах
- Визуальное отображение тегов в интерфейсе

#### 6. Управление пользователями
- **Единая страница** для всех пользователей
- **Фильтрация**:
  - По ботам
  - По статусу (активные/заблокированные/покинувшие)
  - По источникам трафика
  - По тегам
- **Действия**:
  - Блокировка/разблокировка
  - Отправка индивидуальных сообщений
  - Управление тегами
- **Адаптивный интерфейс**:
  - Карточки на мобильных устройствах
  - Таблица на десктопе
- Автоматическое обновление статуса при блокировке бота пользователем

#### 7. Аналитика и статистика
- **Dashboard** с ключевыми метриками:
  - Общее количество пользователей
  - Активные пользователи
  - Количество рассылок
  - Успешность рассылок
- **График новых пользователей** (последние 30 дней)
- **Воронка конверсий**:
  - Зарегистрировались
  - Получили приветственное сообщение
  - Остались активными
- **Статистика по источникам трафика**:
  - Количество пользователей
  - Конверсия
  - Активность
- **Статистика по рассылкам**:
  - Отправлено/не доставлено
  - Прогресс в реальном времени

#### 8. Безопасность и мониторинг
- JWT аутентификация с refresh токенами
- Хеширование паролей (bcrypt)
- CORS защита
- Health check endpoints для мониторинга
- Структурированное логирование
- Автоматическое обновление статуса пользователей

## Архитектура

### Технологический стек

- **Frontend**: 
  - Next.js 14+ (App Router)
  - React 18+
  - TypeScript
  - Tailwind CSS
  - React Query (TanStack Query)
  - React Hook Form + Zod

- **Backend**: 
  - Node.js + Express
  - TypeScript
  - Prisma (ORM)
  - PostgreSQL 16 (база данных)
  - Redis 7 (очереди и кэш)
  - BullMQ (очереди/фоновые задачи)
  - grammY (Telegram Bot API)

- **Infrastructure**: 
  - Docker & Docker Compose
  - Nginx (опционально, для production)

### Компоненты системы

1. **API Server** (Node.js/Express) — REST API для фронтенда
2. **Queue/Workers** (BullMQ) — обработка фоновых задач (рассылки и т.п.)
3. **Bot Manager** — управление жизненным циклом Telegram ботов
4. **PostgreSQL** — основное хранилище данных
5. **Redis** — очередь/кэш

## Структура проекта

```
GateGram/
├── backend-node/                # Backend приложение (Node.js/Express)
│   ├── prisma/                  # Prisma schema
│   ├── src/                     # API + workers + bot manager
│   └── media/                   # Медиа файлы рассылок (временное хранение до отправки)
│
├── frontend/                    # Frontend приложение (Next.js)
│   ├── app/                     # Next.js App Router
│   │   ├── api/                 # API routes (если есть)
│   │   ├── bots/                # Страницы управления ботами
│   │   ├── broadcasts/          # Страницы рассылок
│   │   ├── components/          # React компоненты
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Утилиты и конфигурация
│   │   ├── providers/           # React providers
│   │   ├── utils/               # Вспомогательные функции
│   │   ├── layout.tsx           # Корневой layout
│   │   └── page.tsx             # Главная страница
│   ├── public/                  # Статические файлы
│   ├── Dockerfile               # Docker образ
│   ├── package.json             # Node.js зависимости
│   ├── next.config.js           # Конфигурация Next.js
│   ├── tailwind.config.ts       # Конфигурация Tailwind
│   └── tsconfig.json            # TypeScript конфигурация
│
├── docker-compose.yml           # Docker Compose конфигурация
└── README.md                    # Этот файл
```

## Требования

### Для запуска через Docker

- **Docker** 20.10+
- **Docker Compose** 2.0+

### Для локальной разработки

- **Node.js** 18+
- **Node.js** 20+
- **PostgreSQL** 16+ (или Docker)
- **Redis** 7+ (или Docker)

## Установка и запуск

### Вариант 1: Запуск через Docker Compose (рекомендуется)

1. **Клонируйте репозиторий:**

```bash
git clone <repository-url>
cd GateGram
```

2. **Создайте файлы с переменными окружения:**

**Важно**: Все сервисы (postgres, backend-node) используют `.env` в корне проекта, фронтенд использует `frontend/.env.local`.

Создайте файл `.env` в корне проекта:

```bash
# Database - укажите либо DATABASE_URL, либо компоненты
# Вариант 1: Прямой URL
DATABASE_URL=postgresql://gategram:your_password@postgres:5432/gategram

# Вариант 2: Компоненты (будет построен DATABASE_URL автоматически)
POSTGRES_USER=gategram
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=gategram

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
SECRET_KEY=your-secret-key-change-in-production-min-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# App
DEBUG=False
APP_NAME=GateGram
TELEGRAM_API_URL=https://api.telegram.org
```

**Важно**: 
- Замените `POSTGRES_PASSWORD` и `SECRET_KEY` на безопасные значения
- `SECRET_KEY` минимум 32 символа, можно сгенерировать: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

Создайте файл `frontend/.env.local`:

```bash
# API URL (обязательно)
NEXT_PUBLIC_API_URL=http://localhost:8001/api

# Для production используйте URL вашего сервера:
# NEXT_PUBLIC_API_URL=http://your-domain.com:8001/api
```


4. **Запустите все сервисы:**

```bash
docker compose up -d
```

Эта команда запустит:
- PostgreSQL (порт 5432)
- Redis (порт 6379)
- Backend API (Node.js, порт 8001)
- Frontend (порт 3000)

5. **Примените схему БД (Prisma):**

```bash
docker compose exec backend-node npx prisma db push
```

6. **Проверьте статус сервисов:**

```bash
docker compose ps
```

Все сервисы должны быть в статусе `Up`.

7. **Откройте в браузере:**

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001

8. **Создайте первого пользователя:**

Используйте страницу регистрации в UI или `POST /api/auth/register`.

### Вариант 2: Локальная разработка

#### Backend

1. **Установите зависимости:**

```bash
cd backend-node
npm install
```

2. **Настройте переменные окружения:**

Создайте файл `.env` в корне проекта:

```bash
DATABASE_URL=postgresql://gategram:gategram@localhost:5432/gategram
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key-change-in-production-min-32-characters
CORS_ORIGINS=http://localhost:3000
```

3. **Убедитесь, что PostgreSQL и Redis запущены:**

```bash
# PostgreSQL должен быть доступен на localhost:5432
# Redis должен быть доступен на localhost:6379
```

4. **Примените миграции:**

```bash
npx prisma db push
```

5. **Запустите сервер:**

```bash
npm run dev
```

#### Frontend

1. **Установите зависимости:**

```bash
cd frontend
npm install
```

2. **Создайте файл `.env.local`:**

```bash
NEXT_PUBLIC_API_URL=http://localhost:8001/api
```

3. **Запустите dev сервер:**

```bash
npm run dev
```

Frontend будет доступен на http://localhost:3000

## Переменные окружения

Все переменные для бэкенда (Node.js) и PostgreSQL должны быть в `.env` в корне проекта.  
Все переменные для фронтенда должны быть в `frontend/.env.local`.

### Backend (.env)

| Переменная | Описание | Значение по умолчанию | Обязательно |
|-----------|----------|----------------------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (полный URL) | - | Да* |
| `POSTGRES_USER` | PostgreSQL username | - | Да* |
| `POSTGRES_PASSWORD` | PostgreSQL password | - | Да* |
| `POSTGRES_DB` | PostgreSQL database name | - | Да* |
| `REDIS_URL` | Redis connection string | - | Да |
| `SECRET_KEY` | Секретный ключ для JWT (минимум 32 символа) | - | Да |
| `CORS_ORIGINS` | Разрешенные origins для CORS (через запятую) | `http://localhost:3000,http://localhost:3001` | Нет |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Время жизни access token (минуты) | `30` | Нет |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Время жизни refresh token (дни) | `7` | Нет |
| `DEBUG` | Режим отладки | `False` | Нет |
| `ALGORITHM` | Алгоритм JWT | `HS256` | Нет |
| `APP_NAME` | Имя приложения | `GateGram` | Нет |
| `TELEGRAM_API_URL` | URL Telegram API | `https://api.telegram.org` | Нет |

**\*Примечание**: Укажите либо `DATABASE_URL`, либо `POSTGRES_USER` + `POSTGRES_PASSWORD` + `POSTGRES_DB`.  
Если указаны компоненты, `DATABASE_URL` будет построен автоматически.

### Frontend (frontend/.env.local)

| Переменная | Описание | Значение по умолчанию | Обязательно |
|-----------|----------|----------------------|-------------|
| `NEXT_PUBLIC_API_URL` | URL бэкенд API (с /api) | `http://localhost:8001/api` | Да |

## Модели базы данных

### Основные модели

- **User** — Владельцы аккаунтов в системе
  - email, hashed_password, is_active, created_at

- **Bot** — Telegram боты
  - token, name, username, is_active, owner_id, channels

- **TelegramUser** — Пользователи, взаимодействующие с ботами
  - telegram_user_id, username, first_name, last_name, status, bot_id, tags

- **Broadcast** — Рассылки сообщений
  - bot_id, message_text, media_type, media_url, media_files, status, scheduled_at, filters, total_users, sent_count, failed_count

- **BroadcastLog** — Логи рассылок
  - broadcast_id, telegram_user_id, success, error_message, sent_at

- **MessageTemplate** — Шаблоны сообщений
  - bot_id, name, content, is_active, variables

- **UserTag** — Теги пользователей
  - bot_id, name, color, description

- **Trigger** — Триггеры (автоматические действия)
  - bot_id, name, event_type, conditions, actions, is_active

- **TrafficSource** — Источники трафика
  - bot_id, name, utm_source, utm_medium, utm_campaign

## API Endpoints

API использует REST архитектуру и JWT аутентификацию.

### Основные группы эндпоинтов

- **`/api/auth`** — Аутентификация (регистрация, вход, обновление токена)
- **`/api/bots`** — Управление ботами (CRUD операции)
- **`/api/broadcasts`** — Управление рассылками (создание, отмена, удаление)
- **`/api/analytics`** — Аналитика (статистика по ботам, рассылкам, пользователям)
- **`/api/message-templates`** — Шаблоны сообщений
- **`/api/user-tags`** — Теги пользователей
- **`/api/triggers`** — Триггеры
- **`/api/global-*`** — Глобальные ресурсы (шаблоны, теги, триггеры, пользователи)
- **`/health`** — Мониторинг и health checks

### Health Check и мониторинг

Для проверки состояния приложения доступны следующие эндпоинты:

```bash
# Полная проверка здоровья (БД, Redis)
GET /health

# Быстрая проверка доступности
GET /health/ping
```

Пример ответа `/health`:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-10T12:00:00",
  "database": "ok",
  "redis": "ok",
  "version": "1.0.0"
}
```

Все эндпоинты (кроме `/api/auth/login`, `/api/auth/register` и `/health/*`) требуют аутентификации через JWT токен.

## Фоновые задачи (BullMQ)

BullMQ воркеры (через Redis) обрабатывают:

- Отправку рассылок батчами + rate limiting
- Запланированные рассылки (проверка и постановка в очередь)
- Очистку медиа-файлов после `completed/failed/cancelled/delete`

## Разработка

### Схема БД (Prisma)

```bash
# Применить схему к БД
docker compose exec backend-node npx prisma db push
```

### Логи

Просмотр логов всех сервисов:

```bash
docker compose logs -f
```

Логи конкретного сервиса:

```bash
docker compose logs -f backend-node
docker compose logs -f frontend
```

### Остановка сервисов

```bash
# Остановить все сервисы
docker compose down

# Остановить и удалить volumes (удалит данные БД!)
docker compose down -v
```

### Пересборка образов

```bash
# Пересобрать все образы
docker compose build

# Пересобрать конкретный сервис
docker compose build backend

# Пересобрать и перезапустить
docker compose up -d --build
```

## Production Deployment

### Подготовка к продакшену

1. **Создайте production переменные окружения:**

```bash
# .env.production
DATABASE_URL=postgresql://user:strong_password@your-db-host:5432/gategram
REDIS_URL=redis://your-redis-host:6379/0
SECRET_KEY=very-long-random-string-at-least-32-characters
CORS_ORIGINS=https://yourdomain.com
DEBUG=false
LOG_LEVEL=WARNING
```

2. **Используйте HTTPS:**
   - Настройте SSL сертификаты (Let's Encrypt рекомендуется)
   - Используйте nginx как reverse proxy

3. **Настройте мониторинг:**

```bash
# Проверка здоровья приложения
curl https://yourdomain.com/health

# Настройте автоматические проверки (например, через cron)
*/5 * * * * curl -f https://yourdomain.com/health/ping || alert
```

4. **Настройте backup базы данных:**

```bash
# Ежедневный backup PostgreSQL
0 2 * * * docker compose exec -T postgres pg_dump -U gategram gategram > backup_$(date +\%Y\%m\%d).sql
```

5. **Логирование:**
   - Логи автоматически пишутся в stdout/stderr
   - Используйте `docker compose logs` для просмотра
   - Настройте ротацию логов в Docker

6. **Масштабирование:**

```bash
# Масштабирование сервисов через Docker Compose (при необходимости)
# Важно: при масштабировании backend-node убедитесь, что очереди/воркеры настроены так,
# чтобы не было дублей обработки задач.
docker compose up -d --scale backend-node=1
```

### Рекомендации по безопасности

- Используйте сильные пароли для БД и Redis
- Регулярно обновляйте зависимости
- Ограничьте доступ к портам БД и Redis (только localhost)
- Настройте firewall
- Используйте Docker secrets для чувствительных данных

## Безопасность

### Реализованные меры

- ✅ Все пароли хешируются с использованием bcrypt
- ✅ JWT токены с настраиваемым временем жизни (access + refresh)
- ✅ CORS настроен для разрешенных origins
- ✅ Соблюдение лимитов Telegram API (30 сообщений/сек)
- ✅ Rate limiting для рассылок
- ✅ Валидация всех входных данных через Pydantic
- ✅ Защита от SQL инъекций через SQLAlchemy ORM
- ✅ Health check endpoints для мониторинга
- ✅ Структурированное логирование
- ✅ Автоматическое обновление статуса пользователей при блокировке бота
- ✅ Безопасная обработка загружаемых файлов

### Рекомендации для production

1. **Измените SECRET_KEY** на случайную строку минимум 32 символа
2. **Используйте HTTPS** для всех соединений
3. **Настройте CORS_ORIGINS** только для ваших доменов
4. **Используйте переменные окружения** для всех секретов
5. **Настройте firewall** для ограничения доступа к БД и Redis
6. **Регулярно обновляйте зависимости**
7. **Настройте мониторинг и логирование**
8. **Используйте reverse proxy** (Nginx) перед API
9. **Настройте резервное копирование БД**

## Troubleshooting

### Проблема: БД не подключается

```bash
# Проверьте статус PostgreSQL
docker compose ps postgres

# Проверьте логи
docker compose logs postgres

# Проверьте health бэкенда
curl http://localhost:8001/health
```

### Проблема: Redis не подключается

```bash
# Проверьте статус Redis
docker compose ps redis

# Проверьте подключение
docker compose exec redis redis-cli ping
```

### Проблема: Миграции не применяются

```bash
# Примените схему Prisma
docker compose exec backend-node npx prisma db push
```

### Проблема: Боты не запускаются

```bash
# Проверьте логи бэкенда
docker compose logs -f backend-node

# Проверьте, что токены ботов валидны
# Проверьте, что боты активны в БД
```

### Проблема: Медиа файлы не загружаются

```bash
# Проверьте права доступа к папке media
docker compose exec backend-node ls -la /app/media/broadcasts

# Проверьте, что папка существует
docker compose exec backend-node mkdir -p /app/media/broadcasts
```

## Производительность

### Рекомендации по оптимизации

1. **Рассылки:**
   - Используются батчи по 30 сообщений с задержкой 1 секунда между батчами
   - Автоматическое соблюдение лимитов Telegram API
   - Обработка очередей через BullMQ воркеры

2. **База данных:**
   - Настройте connection pooling: `?pool_size=10&max_overflow=20`
   - Используйте индексы (уже настроены для основных полей)
   - Регулярно запускайте `VACUUM ANALYZE` для PostgreSQL
   - Мониторьте медленные запросы

3. **Redis:**
   - Используется для очередей BullMQ
   - Можно использовать для кэширования часто запрашиваемых данных
   - Настройте `maxmemory-policy` для production

4. **Медиа файлы:**
   - Автоматическая очистка медиа после `completed/failed/cancelled/delete`
   - Для production можно рассмотреть S3/MinIO для хранения scheduled-рассылок
   - Настройте CDN для быстрой доставки

5. **Мониторинг производительности:**
   ```bash
   # Проверка здоровья системы
   curl http://localhost:8001/health
   ```

6. **Масштабирование:**
   - Для больших рассылок корректнее увеличивать пропускную способность очередей/воркеров (BullMQ) и следить за rate limit Telegram.

## Лицензия

Proprietary

## Поддержка

Для вопросов и проблем создавайте issues в репозитории проекта.