# GateGram 🚀

> Профессиональная SaaS платформа для управления Telegram ботами, автоматизации рассылок и отслеживания трафика

[![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)](https://fastapi.tiangolo.com/)
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
  - FastAPI 0.109+
  - Python 3.12+
  - SQLAlchemy 2.0 (ORM)
  - Alembic (миграции БД)
  - PostgreSQL 16 (база данных)
  - Redis 7 (очереди и кэш)
  - Celery 5.3 (фоновые задачи)
  - aiogram 3.3 (Telegram Bot API)

- **Infrastructure**: 
  - Docker & Docker Compose
  - Nginx (опционально, для production)

### Компоненты системы

1. **API Server** (FastAPI) — REST API для фронтенда
2. **Celery Worker** — обработка фоновых задач (рассылки, триггеры)
3. **Celery Beat** — планировщик задач (проверка неактивных пользователей, очистка файлов)
4. **Bot Manager** — управление жизненным циклом Telegram ботов
5. **PostgreSQL** — основное хранилище данных
6. **Redis** — брокер сообщений для Celery и кэш

## Структура проекта

```
GateGram/
├── backend/                    # Backend приложение (FastAPI)
│   ├── app/
│   │   ├── api/                # API роутеры
│   │   │   ├── auth.py         # Аутентификация
│   │   │   ├── bots.py          # Управление ботами
│   │   │   ├── broadcasts.py    # Рассылки
│   │   │   ├── analytics.py     # Аналитика
│   │   │   ├── message_templates.py  # Шаблоны сообщений
│   │   │   ├── user_tags.py     # Теги пользователей
│   │   │   ├── triggers.py       # Триггеры
│   │   │   └── global_*.py      # Глобальные ресурсы
│   │   ├── core/                # Ядро приложения
│   │   │   ├── config.py        # Конфигурация
│   │   │   └── database.py      # Подключение к БД
│   │   ├── models/              # SQLAlchemy модели
│   │   │   ├── user.py          # Пользователи системы
│   │   │   ├── bot.py           # Telegram боты
│   │   │   ├── telegram_user.py # Пользователи ботов
│   │   │   ├── broadcast.py     # Рассылки
│   │   │   ├── message_template.py  # Шаблоны
│   │   │   ├── user_tag.py      # Теги
│   │   │   ├── trigger.py       # Триггеры
│   │   │   └── traffic_source.py # Источники трафика
│   │   ├── schemas/             # Pydantic схемы
│   │   ├── services/            # Бизнес-логика
│   │   │   ├── bot_manager.py   # Управление ботами
│   │   │   ├── bot_handlers.py  # Обработчики ботов
│   │   │   └── trigger_processor.py  # Обработка триггеров
│   │   ├── tasks/               # Celery задачи
│   │   │   ├── broadcast_tasks.py  # Задачи рассылок
│   │   │   └── trigger_tasks.py    # Задачи триггеров
│   │   ├── utils/               # Утилиты
│   │   │   ├── jwt.py           # JWT токены
│   │   │   ├── password.py      # Хеширование паролей
│   │   │   ├── telegram.py      # Telegram утилиты
│   │   │   ├── template_processor.py  # Обработка шаблонов
│   │   │   └── broadcast_filters.py   # Фильтры рассылок
│   │   ├── celery_app.py        # Конфигурация Celery
│   │   └── main.py              # Точка входа FastAPI
│   ├── alembic/                 # Миграции БД
│   │   ├── versions/            # Файлы миграций
│   │   └── env.py               # Конфигурация Alembic
│   ├── media/                   # Медиа файлы
│   │   ├── broadcasts/          # Файлы рассылок
│   │   └── temp/                # Временные файлы
│   ├── alembic.ini              # Конфигурация Alembic
│   ├── requirements.txt         # Python зависимости
│   ├── pyproject.toml           # Python проект
│   ├── Dockerfile               # Docker образ
│   └── README.md                # Документация бэкенда
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

- **Python** 3.12+
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

2. **Создайте файл с переменными окружения:**

Создайте файл `backend/.env` (если его нет):

```bash
# Backend .env
DATABASE_URL=postgresql://gategram:gategram@postgres:5432/gategram
REDIS_URL=redis://redis:6379/0
SECRET_KEY=your-secret-key-change-in-production-min-32-characters-long
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
DEBUG=False
```

**Важно**: Замените `SECRET_KEY` на случайную строку минимум 32 символа. Можно сгенерировать так:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

3. **Создайте файл для фронтенда (опционально):**

Создайте файл `frontend/.env.local`:

```bash
# Frontend .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. **Запустите все сервисы:**

```bash
docker compose up -d
```

Эта команда запустит:
- PostgreSQL (порт 5432)
- Redis (порт 6379)
- Backend API (порт 8000)
- Frontend (порт 3000)
- Celery Worker
- Celery Beat

5. **Примените миграции базы данных:**

```bash
docker compose exec backend alembic upgrade head
```

6. **Проверьте статус сервисов:**

```bash
docker compose ps
```

Все сервисы должны быть в статусе `Up`.

7. **Откройте в браузере:**

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Документация (Swagger)**: http://localhost:8000/docs
- **API Документация (ReDoc)**: http://localhost:8000/redoc

8. **Создайте первого пользователя:**

Используйте API для регистрации или создайте через Python:

```bash
docker compose exec backend python -c "
from app.core.database import SessionLocal
from app.models.user import User
from app.utils.password import get_password_hash

db = SessionLocal()
user = User(
    email='admin@example.com',
    hashed_password=get_password_hash('your-password'),
    is_active=True
)
db.add(user)
db.commit()
print('User created:', user.email)
db.close()
"
```

### Вариант 2: Локальная разработка

#### Backend

1. **Установите зависимости:**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Настройте переменные окружения:**

Создайте файл `backend/.env`:

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
alembic upgrade head
```

5. **Запустите сервер:**

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

6. **В отдельном терминале запустите Celery Worker:**

```bash
celery -A app.celery_app worker --loglevel=info
```

7. **В еще одном терминале запустите Celery Beat:**

```bash
celery -A app.celery_app beat --loglevel=info
```

#### Frontend

1. **Установите зависимости:**

```bash
cd frontend
npm install
```

2. **Создайте файл `.env.local`:**

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. **Запустите dev сервер:**

```bash
npm run dev
```

Frontend будет доступен на http://localhost:3000

## Переменные окружения

### Backend (.env)

| Переменная | Описание | Значение по умолчанию | Обязательно |
|-----------|----------|----------------------|-------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://gategram:gategram@postgres:5432/gategram` | Да |
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` | Да |
| `SECRET_KEY` | Секретный ключ для JWT (минимум 32 символа) | - | Да |
| `CORS_ORIGINS` | Разрешенные origins для CORS (через запятую) | `http://localhost:3001` | Нет |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Время жизни access token (минуты) | `30` | Нет |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Время жизни refresh token (дни) | `7` | Нет |
| `DEBUG` | Режим отладки | `False` | Нет |
| `ALGORITHM` | Алгоритм JWT | `HS256` | Нет |
| `TELEGRAM_API_URL` | URL Telegram API | `https://api.telegram.org` | Нет |

### Frontend (.env.local)

| Переменная | Описание | Значение по умолчанию | Обязательно |
|-----------|----------|----------------------|-------------|
| `NEXT_PUBLIC_API_URL` | URL бэкенд API | `http://localhost:8000` | Да |

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

API использует REST архитектуру и JWT аутентификацию. Полная документация доступна после запуска бэкенда:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

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

## Фоновые задачи (Celery)

### Задачи рассылок

- **`send_broadcast`** — Отправка рассылки пользователям
  - Rate limiting: 30 сообщений в секунду (лимит Telegram)
  - Поддержка медиа-файлов (фото, видео, аудио, документы)
  - Поддержка медиа-групп (до 10 файлов)
  - Автоматическое удаление медиа-файлов после отправки

### Задачи триггеров

- **`check_inactive_users_task`** — Проверка неактивных пользователей (запускается каждый день в 10:00 UTC)
  - Проверяет пользователей для каждого активного триггера типа "user_inactive"
  - Период неактивности настраивается индивидуально для каждого триггера (7, 14, 30 или 90 дней)
- **`process_trigger_task`** — Обработка триггера

### Планировщик (Celery Beat)

- **`check-inactive-users`** — Каждый день в 10:00 UTC проверяет неактивных пользователей
- **`check-scheduled-broadcasts`** — Каждую минуту проверяет запланированные рассылки
- **`cleanup-old-media-files`** — Каждый день в 2:00 UTC удаляет старые медиа-файлы (старше 30 дней)

## Разработка

### Создание миграций БД

```bash
# Создать новую миграцию
docker compose exec backend alembic revision --autogenerate -m "описание изменений"

# Применить миграции
docker compose exec backend alembic upgrade head

# Откатить последнюю миграцию
docker compose exec backend alembic downgrade -1
```

### Логи

Просмотр логов всех сервисов:

```bash
docker compose logs -f
```

Логи конкретного сервиса:

```bash
docker compose logs -f backend
docker compose logs -f celery
docker compose logs -f celery-beat
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
# Увеличить количество Celery workers
docker compose up -d --scale celery=3
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

# Проверьте подключение
docker compose exec backend python -c "from app.core.database import engine; engine.connect()"
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
# Проверьте текущую версию
docker compose exec backend alembic current

# Просмотрите историю миграций
docker compose exec backend alembic history

# Примените миграции вручную
docker compose exec backend alembic upgrade head
```

### Проблема: Celery задачи не выполняются

```bash
# Проверьте статус Celery Worker
docker compose ps celery

# Проверьте логи
docker compose logs -f celery

# Проверьте подключение к Redis
docker compose exec celery python -c "from app.core.config import settings; import redis; r = redis.from_url(settings.REDIS_URL); r.ping()"
```

### Проблема: Боты не запускаются

```bash
# Проверьте логи бэкенда
docker compose logs -f backend

# Проверьте, что токены ботов валидны
# Проверьте, что боты активны в БД
```

### Проблема: Медиа файлы не загружаются

```bash
# Проверьте права доступа к папке media
docker compose exec backend ls -la /app/media/broadcasts

# Проверьте, что папка существует
docker compose exec backend mkdir -p /app/media/broadcasts
```

## Производительность

### Рекомендации по оптимизации

1. **Рассылки:**
   - Используются батчи по 30 сообщений с задержкой 1 секунда между батчами
   - Автоматическое соблюдение лимитов Telegram API
   - Параллельная обработка через Celery workers
   - Масштабирование: увеличьте количество workers для больших рассылок

2. **База данных:**
   - Настройте connection pooling: `?pool_size=10&max_overflow=20`
   - Используйте индексы (уже настроены для основных полей)
   - Регулярно запускайте `VACUUM ANALYZE` для PostgreSQL
   - Мониторьте медленные запросы

3. **Redis:**
   - Используется для очередей Celery
   - Можно использовать для кэширования часто запрашиваемых данных
   - Настройте `maxmemory-policy` для production

4. **Медиа файлы:**
   - Автоматическая очистка старых файлов (Celery Beat задача)
   - Для production рассмотрите S3/MinIO для хранения
   - Настройте CDN для быстрой доставки

5. **Мониторинг производительности:**
   ```bash
   # Проверка здоровья системы
   curl http://localhost:8000/health
   
   # Мониторинг Celery
   celery -A app.celery_app inspect active
   celery -A app.celery_app inspect stats
   ```

6. **Масштабирование:**
   ```bash
   # Горизонтальное масштабирование Celery workers
   docker compose up -d --scale celery=5
   
   # Для очень больших нагрузок используйте отдельные workers для разных задач
   ```

## Лицензия

Proprietary

## Поддержка

Для вопросов и проблем создавайте issues в репозитории проекта.