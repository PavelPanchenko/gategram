#!/usr/bin/env bash
# Бэкап GateGram: дамп PostgreSQL + медиафайлы + .env в один архив.
#
# Запуск из любой папки: /путь/к/gategram/scripts/backup.sh
# Настройки (переменные окружения или scripts/backup.conf рядом со скриптом):
#   BACKUP_DIR        куда складывать архивы              (по умолчанию ~/backups/gategram)
#   BACKUP_KEEP       сколько последних архивов хранить   (по умолчанию 7)
#   BACKUP_PASSPHRASE_FILE  файл с паролем — архив шифруется gpg (рекомендуется при выгрузке в облако)
#   RCLONE_REMOTE     куда выгружать через rclone, например yandex:gategram-backups (пусто — не выгружать)
#   RCLONE_KEEP_DAYS  сколько дней хранить архивы в облаке (по умолчанию 30)
#
# Затрагивает только контейнеры этого проекта (docker compose), другие проекты на сервере не трогает.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
# shellcheck source=/dev/null
[ -f "$SCRIPT_DIR/backup.conf" ] && . "$SCRIPT_DIR/backup.conf"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/gategram}"
BACKUP_KEEP="${BACKUP_KEEP:-7}"
BACKUP_PASSPHRASE_FILE="${BACKUP_PASSPHRASE_FILE:-}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
RCLONE_KEEP_DAYS="${RCLONE_KEEP_DAYS:-30}"

log() { echo "[$(date '+%F %T')] $*"; }
fail() { log "ОШИБКА: $*"; exit 1; }

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"

# Не запускать два бэкапа одновременно
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || fail "бэкап уже выполняется"

STAMP="$(date +%F_%H%M%S)"
WORK="$(mktemp -d "$BACKUP_DIR/.tmp.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
DATA="$WORK/data"
mkdir -p "$DATA"

log "Дамп базы данных..."
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DATA/db.dump" \
  || fail "pg_dump не удался (запущен ли контейнер postgres?)"
docker compose exec -T postgres pg_restore -l < "$DATA/db.dump" > /dev/null \
  || fail "дамп повреждён: pg_restore не может его прочитать"

log "Медиафайлы..."
MEDIA_VOLUME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/media"}}{{.Name}}{{end}}{{end}}' gategram_backend_node 2>/dev/null || true)"
if [ -n "$MEDIA_VOLUME" ]; then
  docker run --rm -v "$MEDIA_VOLUME":/data:ro -v "$DATA":/backup alpine tar czf /backup/media.tar.gz -C /data .
else
  log "  том с медиа не найден (контейнер gategram_backend_node не создан?) — пропускаю"
fi

log "Настройки..."
cp .env "$DATA/env" 2>/dev/null || log "  .env не найден — пропускаю"
[ -f frontend/.env.local ] && cp frontend/.env.local "$DATA/env.local"

ARCHIVE="$BACKUP_DIR/gategram_$STAMP.tar.gz"
tar czf "$WORK/archive.tar.gz" -C "$DATA" .
if [ -n "$BACKUP_PASSPHRASE_FILE" ]; then
  [ -r "$BACKUP_PASSPHRASE_FILE" ] || fail "нет доступа к файлу пароля $BACKUP_PASSPHRASE_FILE"
  gpg --batch --yes --pinentry-mode loopback --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
    --symmetric --cipher-algo AES256 -o "$WORK/archive.tar.gz.gpg" "$WORK/archive.tar.gz"
  ARCHIVE="$ARCHIVE.gpg"
  mv "$WORK/archive.tar.gz.gpg" "$ARCHIVE"
else
  mv "$WORK/archive.tar.gz" "$ARCHIVE"
fi
chmod 600 "$ARCHIVE"
log "Готово: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Оставляем только последние BACKUP_KEEP архивов
mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/gategram_*.tar.gz* 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))")
for f in "${OLD[@]}"; do
  rm -f -- "$f" && log "Удалён старый архив: $(basename "$f")"
done

if [ -n "$RCLONE_REMOTE" ]; then
  log "Выгрузка в $RCLONE_REMOTE..."
  rclone copy "$ARCHIVE" "$RCLONE_REMOTE" || fail "выгрузка через rclone не удалась"
  rclone delete "$RCLONE_REMOTE" --min-age "${RCLONE_KEEP_DAYS}d" --include 'gategram_*' || log "  не удалось удалить старые архивы в облаке"
  log "Выгружено"
fi
