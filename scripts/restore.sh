#!/usr/bin/env bash
# Восстановление GateGram из архива, сделанного scripts/backup.sh.
#
#   scripts/restore.sh /путь/к/gategram_2026-10-03_0300.tar.gz[.gpg]
#
# Для зашифрованного архива: BACKUP_PASSPHRASE_FILE=/путь/к/файлу_с_паролем scripts/restore.sh ...
# ВНИМАНИЕ: текущие данные базы и медиа этого проекта будут заменены данными из архива.
# .env восстанавливается из архива, только если его ещё нет в папке проекта.

set -euo pipefail

ARCHIVE="${1:-}"
[ -n "$ARCHIVE" ] && [ -f "$ARCHIVE" ] || { echo "Использование: $0 /путь/к/gategram_ДАТА.tar.gz[.gpg]"; exit 1; }
ARCHIVE="$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

log() { echo "[$(date '+%F %T')] $*"; }

read -r -p "База и медиа GateGram будут заменены данными из $(basename "$ARCHIVE"). Продолжить? [y/N] " answer
[ "$answer" = "y" ] || [ "$answer" = "Y" ] || { echo "Отменено"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [[ "$ARCHIVE" == *.gpg ]]; then
  [ -n "${BACKUP_PASSPHRASE_FILE:-}" ] || { echo "Архив зашифрован: укажите BACKUP_PASSPHRASE_FILE"; exit 1; }
  gpg --batch --pinentry-mode loopback --passphrase-file "$BACKUP_PASSPHRASE_FILE" -d "$ARCHIVE" | tar xzf - -C "$WORK"
else
  tar xzf "$ARCHIVE" -C "$WORK"
fi
[ -f "$WORK/db.dump" ] || { echo "В архиве нет db.dump"; exit 1; }

if [ ! -f .env ] && [ -f "$WORK/env" ]; then
  cp "$WORK/env" .env && chmod 600 .env && log ".env восстановлен из архива"
fi
if [ ! -f frontend/.env.local ] && [ -f "$WORK/env.local" ]; then
  cp "$WORK/env.local" frontend/.env.local && log "frontend/.env.local восстановлен из архива"
fi
[ -f .env ] || { echo "Нет .env — создайте его перед восстановлением"; exit 1; }

log "Останавливаю приложение (боты, API, фронтенд)..."
docker compose stop backend-node backend-worker frontend 2>/dev/null || true

log "Запускаю postgres и redis..."
docker compose up -d postgres redis
for _ in $(seq 1 30); do
  docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > /dev/null 2>&1 && break
  sleep 2
done

log "Восстанавливаю базу данных..."
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' < "$WORK/db.dump"

if [ -f "$WORK/media.tar.gz" ]; then
  log "Восстанавливаю медиафайлы..."
  # create без запуска — чтобы появился том backend_media с правильным именем
  docker compose create backend-node > /dev/null 2>&1 || docker compose up --no-start backend-node
  MEDIA_VOLUME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/media"}}{{.Name}}{{end}}{{end}}' gategram_backend_node)"
  docker run --rm -v "$MEDIA_VOLUME":/data -v "$WORK":/backup:ro alpine sh -c 'rm -rf /data/* && tar xzf /backup/media.tar.gz -C /data'
fi

log "Запускаю приложение..."
docker compose up -d --build
log "Готово. Проверьте вход в панель и работу ботов."
