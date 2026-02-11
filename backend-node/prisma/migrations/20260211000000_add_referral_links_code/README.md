# Миграция: колонка referral_links.code

Применить один раз (из корня проекта, с подключением к той же БД, что и backend):

**Вариант A — через Prisma (рекомендуется)**  
Из папки `backend-node`, с переменной `DATABASE_URL` в окружении (например из `.env` в корне):

```bash
cd backend-node
export DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DBNAME"   # или источник из .env
npx prisma migrate deploy
```

**Вариант B — синхронизация схемы без миграций**

```bash
cd backend-node
npx prisma db push
```

**Вариант C — выполнить SQL вручную**  
В psql или любом клиенте к вашей БД:

```sql
ALTER TABLE "referral_links" ADD COLUMN IF NOT EXISTS "code" VARCHAR(32);
CREATE INDEX IF NOT EXISTS "referral_links_bot_id_code_idx" ON "referral_links"("bot_id", "code");
```

После применения перезапустите backend (например `docker compose up -d backend-node`).
