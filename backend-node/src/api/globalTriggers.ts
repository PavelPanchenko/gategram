import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';

const router = express.Router();

/**
 * GET /api/triggers
 * Получить все триггеры (с опциональным фильтром по боту)
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = req.query.bot_id ? parseInt(req.query.bot_id as string, 10) : undefined;

    // Получаем все боты пользователя
    const userBots = await prisma.bot.findMany({
      where: { ownerId: userId },
    });

    const botIds = userBots.map((bot) => bot.id);

    if (botIds.length === 0) {
      return res.json([]);
    }

    // Запрос триггеров
    const where: any = {
      botId: { in: botIds },
    };

    // Применяем фильтр по bot_id, если указан
    if (botId !== undefined) {
      if (!botIds.includes(botId)) {
        return res.json([]); // Бот не принадлежит пользователю
      }
      where.botId = botId;
    }

    const triggers = await prisma.trigger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Добавляем информацию о боте к каждому триггеру
    const result = triggers.map((trigger) => {
      const bot = userBots.find((b) => b.id === trigger.botId);
      const botName = bot
        ? bot.name || bot.username || `Bot #${bot.id}`
        : null;

      return {
        id: trigger.id,
        bot_id: trigger.botId,
        name: trigger.name,
        event_type: trigger.eventType,
        conditions: trigger.conditions as any,
        actions: trigger.actions as any[],
        is_active: trigger.isActive,
        created_at: trigger.createdAt,
        updated_at: trigger.updatedAt,
        bot_name: botName,
        // Старые поля для обратной совместимости
        action_type: (trigger.actionType as string) || null,
        action_data: (trigger.actionData as any) || null,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('Error getting all triggers:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
