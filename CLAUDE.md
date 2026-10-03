# GateGram

Панель управления Telegram-ботами: `frontend` (Next.js 14), `backend-node` (Express + Prisma + grammY),
`backend-worker` (очереди), Postgres, Redis, Caddy как reverse proxy. Всё запускается через `docker-compose.yml`.

## Продакшен-сервер (VPS 185.253.218.21)

**На том же сервере работает другой проект — контейнер `telegram-broadcast`. Его не трогаем.**

- Не предлагать команды, которые действуют на все контейнеры сервера: `docker system prune`,
  `docker stop $(docker ps -q)`, `docker rm -f $(docker ps -aq)`, `docker network prune`, `docker volume prune` и т.п.
  Только `docker compose ...` из папки `gategram` — они затрагивают лишь сервисы этого проекта.
- Перед тем как публиковать новый порт или менять порты в `docker-compose.yml`, проверять занятость
  (`docker ps`, `ss -tlnp`) — порт может использовать `telegram-broadcast`.
- Имена контейнеров (`container_name`) и volumes не должны совпадать с контейнерами `telegram-broadcast`.
- Учитывать общую память: на сервере ~2 ГБ RAM + 2 ГБ swap, делятся между обоими проектами.

## Устройство деплоя

- Снаружи открыт только Caddy (80/443, `caddy/Caddyfile`): `/api/*` → `backend-node:8001`, остальное → `frontend:3000`.
  Порты 3000, 8001, 5432 опубликованы только на `127.0.0.1`.
- HTTPS включается через `SITE_ADDRESS=домен` в корневом `.env`; без него сайт работает по HTTP на 80.
- Фронтенд ходит в API по относительному `/api`, поэтому в `CORS_ORIGINS` должен быть адрес сайта
  (сейчас `http://185.253.218.21`).
- У всех сервисов `restart: unless-stopped` — после перезагрузки VPS всё поднимается само.
- Обновление: `git pull && docker compose up -d --build`.
