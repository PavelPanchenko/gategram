-- CreateTable
CREATE TABLE IF NOT EXISTS "user_notification_settings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "error_notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notify_bot_id" INTEGER,
    "notify_telegram_user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_notification_settings_user_id_key" ON "user_notification_settings"("user_id");
CREATE INDEX IF NOT EXISTS "user_notification_settings_notify_bot_id_idx" ON "user_notification_settings"("notify_bot_id");
CREATE INDEX IF NOT EXISTS "user_notification_settings_notify_telegram_user_id_idx" ON "user_notification_settings"("notify_telegram_user_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "user_notification_settings"
    ADD CONSTRAINT "user_notification_settings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_notification_settings"
    ADD CONSTRAINT "user_notification_settings_notify_bot_id_fkey"
    FOREIGN KEY ("notify_bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_notification_settings"
    ADD CONSTRAINT "user_notification_settings_notify_telegram_user_id_fkey"
    FOREIGN KEY ("notify_telegram_user_id") REFERENCES "telegram_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
