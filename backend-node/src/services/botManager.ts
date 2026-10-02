/**
 * Менеджер для управления жизненным циклом Telegram ботов
 */

import { Bot, Context, GrammyError, HttpError } from 'grammy';
import { setupBotHandlers } from './botHandlers';
import { notifyBotOwnerError } from './errorNotifier';
import prisma from '../core/database';
import { describeError } from '../utils/redact';

// Повторный запуск при сетевых ошибках (таймаут до api.telegram.org и т.п.):
// 30с, 1м, 2м, 4м, 8м, затем каждые 10м — всего ~1.5 часа
const RETRY_BASE_DELAY_MS = 30_000;
const RETRY_MAX_DELAY_MS = 10 * 60_000;
const RETRY_MAX_ATTEMPTS = 12;

type BotInstance = {
  bot: Bot;
  isRunning: boolean;
  stopPolling?: () => void;
};

class BotManager {
  private bots: Map<number, BotInstance> = new Map();
  private retryTimers: Map<number, NodeJS.Timeout> = new Map();

  /**
   * Запускает бота с заданными обработчиками.
   * При сетевой ошибке возвращает false и планирует повторные попытки в фоне.
   */
  async startBot(botId: number, token: string): Promise<boolean> {
    this.cancelRetry(botId);
    return this.tryStart(botId, token, 0);
  }

  /** Запланирован ли повторный запуск бота после сетевой ошибки */
  isRetryScheduled(botId: number): boolean {
    return this.retryTimers.has(botId);
  }

  private cancelRetry(botId: number): void {
    const timer = this.retryTimers.get(botId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(botId);
    }
  }

  private scheduleRetry(botId: number, attempt: number, lastError: unknown): void {
    if (attempt >= RETRY_MAX_ATTEMPTS) {
      console.error(`Bot ${botId}: giving up after ${attempt} retries`);
      void notifyBotOwnerError(botId, `bot ${botId} start`, lastError);
      return;
    }
    const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
    console.warn(`Bot ${botId}: retry ${attempt + 1}/${RETRY_MAX_ATTEMPTS} in ${Math.round(delay / 1000)}s`);
    const timer = setTimeout(() => {
      this.retryTimers.delete(botId);
      void this.retryStart(botId, attempt + 1);
    }, delay);
    timer.unref();
    this.retryTimers.set(botId, timer);
  }

  private async retryStart(botId: number, attempt: number): Promise<void> {
    try {
      // Берём актуальные данные: бота могли выключить, удалить или сменить ему токен
      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      if (!bot || !bot.isActive || this.bots.has(botId)) return;
      await this.tryStart(botId, bot.token, attempt);
    } catch (error) {
      console.error(`Bot ${botId}: retry failed: ${describeError(error)}`);
      this.scheduleRetry(botId, attempt, error);
    }
  }

  private async tryStart(botId: number, token: string, attempt: number): Promise<boolean> {
    if (this.bots.has(botId)) {
      console.warn(`Bot ${botId} is already running`);
      return false;
    }

    try {
      console.log(`Starting bot ${botId} with token ${token.slice(0, 10)}...`);

      const bot = new Bot(token);

      // Проверяем токен до запуска polling (401 = неверный/отозванный токен)
      try {
        await bot.api.getMe();
      } catch (err: unknown) {
        const isUnauthorized =
          err instanceof GrammyError && err.error_code === 401 ||
          (err as { error_code?: number })?.error_code === 401;
        if (isUnauthorized) {
          console.error(`Bot ${botId}: invalid or revoked token (401 Unauthorized). Update the token in BotFather and in the bot settings.`);
        } else {
          console.error(`Bot ${botId}: getMe failed: ${describeError(err)}`);
          if (err instanceof HttpError) {
            this.scheduleRetry(botId, attempt, err);
          }
        }
        return false;
      }

      setupBotHandlers(bot, botId);

      bot.catch((err) => {
        const e = err.error as { error_code?: number; description?: string };
        if (e?.error_code === 403 && String(e.description || '').includes('blocked by the user')) return;
        if (e?.error_code === 400 && String(e.description || '').toLowerCase().includes('query is too old')) return;
        const ctx = err.ctx;
        console.error(`Error while handling update ${ctx.update.update_id}:`);
        if (e instanceof GrammyError) {
          console.error('Error in request:', e.description);
        } else if (e instanceof HttpError) {
          console.error('Could not contact Telegram:', describeError(e));
        } else {
          console.error('Unknown error:', e);
        }
        void notifyBotOwnerError(botId, `bot ${botId} update`, err.error);
      });

      const stopPolling = () => {
        bot.stop();
      };

      bot.start({
        allowed_updates: ['message', 'callback_query', 'chat_member', 'my_chat_member'],
      }).catch((error) => {
        console.error(`Error starting polling for bot ${botId}: ${describeError(error)}`);
        this.bots.delete(botId);
        void notifyBotOwnerError(botId, `bot ${botId} polling`, error);
      });

      this.bots.set(botId, {
        bot,
        isRunning: true,
        stopPolling,
      });

      console.log(`Bot ${botId} started successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to start bot ${botId}: ${describeError(error)}`);
      if (this.bots.has(botId)) {
        await this.stopBot(botId);
      }
      return false;
    }
  }

  /**
   * Останавливает бота
   */
  async stopBot(botId: number): Promise<boolean> {
    this.cancelRetry(botId);
    if (!this.bots.has(botId)) {
      console.warn(`Bot ${botId} is not running`);
      return false;
    }

    try {
      const instance = this.bots.get(botId)!;
      
      // Останавливаем polling
      if (instance.stopPolling) {
        instance.stopPolling();
      }
      
      // Останавливаем бота
      await instance.bot.stop();

      // Удаляем из словаря
      this.bots.delete(botId);

      console.log(`Bot ${botId} stopped successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to stop bot ${botId}:`, error);
      return false;
    }
  }

  /**
   * Перезапускает бота
   */
  async restartBot(botId: number, token: string): Promise<boolean> {
    await this.stopBot(botId);
    return await this.startBot(botId, token);
  }

  /**
   * Проверяет, запущен ли бот
   */
  isRunning(botId: number): boolean {
    return this.bots.has(botId) && this.bots.get(botId)?.isRunning === true;
  }

  /**
   * Получает экземпляр бота по ID
   */
  getBot(botId: number): Bot | null {
    return this.bots.get(botId)?.bot || null;
  }

  /**
   * Останавливает всех ботов
   */
  async stopAll(): Promise<void> {
    for (const botId of Array.from(this.retryTimers.keys())) {
      this.cancelRetry(botId);
    }
    const botIds = Array.from(this.bots.keys());
    for (const botId of botIds) {
      await this.stopBot(botId);
    }
  }
}

// Глобальный экземпляр менеджера
export const botManager = new BotManager();
