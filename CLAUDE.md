# GateGram

Панель управления Telegram-ботами: `frontend` (Next.js 14), `backend-node` (Express + Prisma + grammY),
`backend-worker` (очереди), Postgres, Redis, Caddy как reverse proxy. Всё запускается через `docker-compose.yml`.

## Продакшен-сервер (Zomro, 212.43.151.27)

Ubuntu 24.04, 1 vCPU / 2.4 ГБ RAM + 2 ГБ swap, диск 14 ГБ, вход только по SSH-ключу (`root`; пароль отключён в
`/etc/ssh/sshd_config.d/01-key-only.conf`). Проекты лежат в `/root/gategram` и `/root/telegram_broadcast`.
Файрвол ufw пропускает только SSH, 80, 443 (порты, которые публикует Docker, он не фильтрует); на 22/tcp правило
`LIMIT` — больше 6 SSH-подключений за 30 с сбрасываются, поэтому не открывать много ssh/scp подряд в цикле.
Одно ядро: первая сборка образов идёт 10–15 минут. Диск небольшой — следить за местом, старые образы чистить
через `docker image prune` (не `system prune`).

Предыдущий сервер — DigitalOcean 167.71.61.101 (до 2026-11-02): приложения и cron там остановлены, сервер под удаление.

**На том же сервере работает другой проект — `telegram-broadcast` (репозиторий PavelPanchenko/telegram_broadcast). Его не трогаем.**

- Не предлагать команды, которые действуют на все контейнеры сервера: `docker system prune`,
  `docker stop $(docker ps -q)`, `docker rm -f $(docker ps -aq)`, `docker network prune`, `docker volume prune` и т.п.
  Только `docker compose ...` из папки `gategram` — они затрагивают лишь сервисы этого проекта.
- Перед тем как публиковать новый порт или менять порты в `docker-compose.yml`, проверять занятость
  (`docker ps`, `ss -tlnp`) — порт может использовать `telegram-broadcast`.
- Имена контейнеров (`container_name`) и volumes не должны совпадать с контейнерами `telegram-broadcast`.
- Учитывать общую память: ~2 ГБ RAM + 2 ГБ swap делятся между обоими проектами.

## Устройство деплоя

- Снаружи открыт только Caddy (`caddy/Caddyfile`), он обслуживает оба проекта:
  - GateGram — `SITE_ADDRESS` (по умолчанию `:80`, http://212.43.151.27/): `/api/*` → `backend-node:8001`, остальное → `frontend:3000`;
  - telegram-broadcast — `BROADCAST_ADDRESS` (по умолчанию `:5001`, http://212.43.151.27:5001/) → `telegram-broadcast:5001`
    через общую Docker-сеть `vps-edge`. Сеть создаётся этим compose-файлом, telegram-broadcast подключается к ней как external,
    поэтому GateGram (Caddy) нужно поднимать первым.
- Порты 3000, 8001, 5432 опубликованы только на `127.0.0.1`; telegram-broadcast сам порты не публикует.
- HTTPS: указать домен в `SITE_ADDRESS` / `BROADCAST_ADDRESS` в корневом `.env` — Caddy выпустит сертификат сам.
  Домена пока нет, оба проекта работают по HTTP.
- Фронтенд ходит в API по относительному `/api` (`NEXT_PUBLIC_API_URL=/api`, в т.ч. в `frontend/.env.local`),
  поэтому в `CORS_ORIGINS` должен быть адрес сайта (сейчас `http://212.43.151.27`).
- У всех сервисов `restart: unless-stopped` — после перезагрузки VPS всё поднимается само.
- Обновление: `git pull && docker compose up -d --build`.

## Бэкапы

`scripts/backup.sh` (дамп БД + медиа + `.env`, ротация, gpg, rclone) и `scripts/restore.sh`. Настройки — `scripts/backup.conf`
(не в git, пример в `scripts/backup.conf.example`). Подробности — README, раздел «Бэкапы».

На сервере: архивы шифруются паролем из `/root/.gategram-backup-pass` и выгружаются в Dropbox — в общую папку,
к которой дали доступ (rclone remote `dropbox:`, путь `Getagram.Brodcast/gategram-backups` и
`Getagram.Brodcast/telegram-broadcast-backups`; в `backup.conf` путь в кавычках). Старая папка `Гетаграм+Бродкаст`
с частью архивов telegram-broadcast больше не используется — удалять её только через веб-интерфейс Dropbox. Яндекс Диск больше не используется
(remote удалён, старые архивы там недоступны). Cron (UTC):
03:17 — GateGram, 03:27 — telegram-broadcast; логи в `/var/log/gategram-backup.log` и `/var/log/telegram-broadcast-backup.log`.
