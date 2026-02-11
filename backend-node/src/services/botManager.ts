/**
 * Менеджер для управления жизненным циклом Telegram ботов
 */

import { Bot, Context, GrammyError, HttpError } from 'grammy';
import { setupBotHandlers } from './botHandlers';

type BotInstance = {
  bot: Bot;
  isRunning: boolean;
  stopPolling?: () => void;
};

class BotManager {
  private bots: Map<number, BotInstance> = new Map();

  /**
   * Запускает бота с заданными обработчиками
   */
  async startBot(botId: number, token: string): Promise<boolean> {
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
          console.error(`Bot ${botId}: getMe failed:`, err);
        }
        return false;
      }

      setupBotHandlers(bot, botId);

      bot.catch((err) => {
        const ctx = err.ctx;
        console.error(`Error while handling update ${ctx.update.update_id}:`);
        const e = err.error;
        if (e instanceof GrammyError) {
          console.error('Error in request:', e.description);
        } else if (e instanceof HttpError) {
          console.error('Could not contact Telegram:', e);
        } else {
          console.error('Unknown error:', e);
        }
      });

      const stopPolling = () => {
        bot.stop();
      };

      bot.start({
        allowed_updates: ['message', 'callback_query', 'chat_member', 'my_chat_member'],
      }).catch((error) => {
        console.error(`Error starting polling for bot ${botId}:`, error);
        this.bots.delete(botId);
      });

      this.bots.set(botId, {
        bot,
        isRunning: true,
        stopPolling,
      });

      console.log(`Bot ${botId} started successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to start bot ${botId}:`, error);
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
    const botIds = Array.from(this.bots.keys());
    for (const botId of botIds) {
      await this.stopBot(botId);
    }
  }
}

// Глобальный экземпляр менеджера
export const botManager = new BotManager();
