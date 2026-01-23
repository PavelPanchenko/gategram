# GateGram Backend (Node.js)

Node.js версия бэкенда для GateGram.

## 🚀 Быстрый старт

### Локальная разработка

1. Установите зависимости:
```bash
npm install
```

2. Настройте переменные окружения:
Создайте файл `.env` в корне проекта (или `.env` в папке `backend-node`).

3. Сгенерируйте Prisma Client:
```bash
npx prisma generate
```

4. Запустите в режиме разработки:
```bash
npm run dev
```

Сервер будет доступен на `http://localhost:8001`

## 📁 Структура проекта

```
backend-node/
├── src/
│   ├── api/          # API роутеры
│   ├── core/         # Конфигурация и подключение к БД
│   ├── middleware/   # Express middleware
│   └── utils/        # Утилиты (JWT, пароли)
├── prisma/
│   └── schema.prisma # Prisma схема
├── dist/             # Скомпилированный TypeScript
└── package.json
```

## 🔧 Настройка

### Переменные окружения

Все переменные читаются из `.env`.

**Обязательные переменные:**
- `DATABASE_URL` - строка подключения к PostgreSQL (например: `postgresql://user:password@postgres:5432/gategram`)
- `REDIS_URL` - строка подключения к Redis (например: `redis://redis:6379`)

**Опциональные переменные (есть дефолты):**
- `SECRET_KEY` - секретный ключ для JWT (по умолчанию: `your-secret-key-change-in-production`)
- `ALGORITHM` - алгоритм JWT (по умолчанию: `HS256`)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - время жизни access token (по умолчанию: `30`)
- `REFRESH_TOKEN_EXPIRE_DAYS` - время жизни refresh token (по умолчанию: `7`)
- `PORT` - порт сервера (по умолчанию: `8001`)
- `CORS_ORIGINS` - список разрешенных origins через запятую (по умолчанию: `http://localhost:3000,http://localhost:3001`)
- `NODE_ENV` - окружение (по умолчанию: `development`)
- `TELEGRAM_API_URL` - URL Telegram API (по умолчанию: `https://api.telegram.org`)

**Пример минимального .env файла:**
```env
DATABASE_URL=postgresql://user:password@postgres:5432/gategram
REDIS_URL=redis://redis:6379
SECRET_KEY=your-secret-key-change-in-production
```

## 📦 Скрипты

- `npm run dev` - запуск в режиме разработки с hot reload
- `npm run build` - сборка TypeScript
- `npm start` - запуск production версии
- `npm run prisma:generate` - генерация Prisma Client
- `npm run prisma:studio` - открыть Prisma Studio

## 🐳 Docker

Бэкенд автоматически запускается через `docker-compose.yml` на порту **8001**.

## 📝 API Endpoints

### Auth
- `POST /api/auth/register` - регистрация
- `POST /api/auth/login` - вход
- `POST /api/auth/refresh` - обновление токена

### Health
- `GET /api/health` - проверка здоровья (БД, Redis)
- `GET /api/health/ping` - простая проверка

## 🔄 Примечание

Этот проект использует Node.js бэкенд на порту **8001**.
