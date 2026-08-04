#!/bin/sh
set -e

# В Docker Postgres доступен как hostname "postgres", а в .env часто localhost —
# подменяем host/port если заданы DATABASE_URL_HOST / DATABASE_URL_PORT.
if [ -n "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="$(
    node -e '
      const u = new URL(process.env.DATABASE_URL);
      if (process.env.DATABASE_URL_HOST) u.hostname = process.env.DATABASE_URL_HOST;
      if (process.env.DATABASE_URL_PORT) u.port = process.env.DATABASE_URL_PORT;
      process.stdout.write(u.toString());
    '
  )"
fi

if [ "${SKIP_PRISMA_MIGRATE:-0}" != "1" ]; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy
fi

exec "$@"
