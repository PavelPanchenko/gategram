-- AlterTable: добавить колонку code для коротких реферальных ссылок (лимит Telegram start = 64 символа)
ALTER TABLE "referral_links" ADD COLUMN IF NOT EXISTS "code" VARCHAR(32);

-- CreateIndex: для поиска по (bot_id, code)
CREATE INDEX IF NOT EXISTS "referral_links_bot_id_code_idx" ON "referral_links"("bot_id", "code");
