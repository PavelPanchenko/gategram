import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';

const router = express.Router();

/**
 * GET /api/tags
 * Получить все теги (с опциональным фильтром по боту)
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

    // Запрос тегов
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

    const tags = await prisma.userTag.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Добавляем информацию о боте к каждому тегу
    const result = tags.map((tag) => {
      const bot = userBots.find((b) => b.id === tag.botId);
      const botName = bot
        ? bot.name || bot.username || `Bot #${bot.id}`
        : null;

      return {
        id: tag.id,
        bot_id: tag.botId,
        name: tag.name,
        color: tag.color,
        description: tag.description,
        created_at: tag.createdAt,
        bot_name: botName,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('Error getting all tags:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
