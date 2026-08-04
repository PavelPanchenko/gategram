/**
 * Уведомления владельца аккаунта об ошибках в Telegram.
 * Настройки: UserNotificationSettings (бот + получатель из TelegramUser).
 */

import prisma from '../core/database';
import { sendTelegramMessage } from '../utils/telegram';

const DEBOUNCE_MS = 5 * 60 * 1000; // 5 минут на одинаковую ошибку
const recentErrors = new Map<string, number>();

export type ErrorNotifyPayload = {
  source: string;
  message: string;
  stack?: string;
  userId?: number;
  botId?: number;
  meta?: Record<string, string | number | boolean | undefined | null>;
};

function sanitize(text: string, maxLen: number): string {
  const redacted = text
    .replace(/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g, '[REDACTED_TOKEN]')
    .replace(/(password|secret|token|authorization)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
  return redacted.length > maxLen ? `${redacted.slice(0, maxLen)}…` : redacted;
}

function debounceKey(userId: number, source: string, message: string): string {
  return `${userId}:${source}:${message.slice(0, 200)}`;
}

function shouldSkip(userId: number, source: string, message: string): boolean {
  const key = debounceKey(userId, source, message);
  const now = Date.now();
  const prev = recentErrors.get(key);
  if (prev && now - prev < DEBOUNCE_MS) {
    return true;
  }
  recentErrors.set(key, now);

  // периодическая чистка
  if (recentErrors.size > 500) {
    for (const [k, ts] of recentErrors) {
      if (now - ts > DEBOUNCE_MS) recentErrors.delete(k);
    }
  }
  return false;
}

function formatMessage(payload: ErrorNotifyPayload): string {
  const lines = [
    '⚠️ GateGram: ошибка',
    `Источник: ${sanitize(payload.source, 80)}`,
    `Сообщение: ${sanitize(payload.message, 500)}`,
  ];

  if (payload.botId != null) {
    lines.push(`Bot ID: ${payload.botId}`);
  }
  if (payload.meta) {
    for (const [k, v] of Object.entries(payload.meta)) {
      if (v === undefined || v === null) continue;
      lines.push(`${k}: ${sanitize(String(v), 120)}`);
    }
  }
  if (payload.stack) {
    lines.push(`Stack:\n${sanitize(payload.stack, 800)}`);
  }

  return lines.join('\n').slice(0, 3500);
}

async function resolveUserId(payload: ErrorNotifyPayload): Promise<number | null> {
  if (payload.userId) return payload.userId;
  if (payload.botId) {
    const bot = await prisma.bot.findUnique({
      where: { id: payload.botId },
      select: { ownerId: true },
    });
    return bot?.ownerId ?? null;
  }
  return null;
}

/**
 * Отправляет уведомление владельцу (если включено в настройках).
 * Ошибки внутри notifier глотаются — без рекурсии.
 */
export async function notifyOwnerError(payload: ErrorNotifyPayload): Promise<void> {
  try {
    const userId = await resolveUserId(payload);
    if (!userId) return;

    if (shouldSkip(userId, payload.source, payload.message)) return;

    const settings = await prisma.userNotificationSettings.findUnique({
      where: { userId },
      include: {
        notifyBot: { select: { id: true, token: true, ownerId: true } },
        notifyTelegramUser: {
          select: { id: true, telegramUserId: true, botId: true, status: true },
        },
      },
    });

    if (!settings?.errorNotificationsEnabled) return;
    if (!settings.notifyBot || !settings.notifyTelegramUser) return;
    if (settings.notifyBot.ownerId !== userId) return;
    if (settings.notifyTelegramUser.botId !== settings.notifyBot.id) return;

    const chatId = settings.notifyTelegramUser.telegramUserId.toString();
    const text = formatMessage(payload);
    const result = await sendTelegramMessage(settings.notifyBot.token, chatId, text);
    if (!result.ok) {
      console.error('notifyOwnerError: failed to send:', result.description);
    }
  } catch (err) {
    console.error('notifyOwnerError failed:', err instanceof Error ? err.message : err);
  }
}

/** Удобный хелпер для ошибок бота */
export async function notifyBotOwnerError(
  botId: number,
  source: string,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  await notifyOwnerError({ botId, source, message, stack });
}
