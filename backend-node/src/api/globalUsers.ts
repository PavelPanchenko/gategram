import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';

const router = express.Router();

/**
 * GET /api/users
 * Получить всех пользователей всех ботов пользователя, с возможностью фильтрации
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = req.query.bot_id ? parseInt(req.query.bot_id as string, 10) : undefined;
    const statusFilter = req.query.status_filter as string | undefined;
    const sourceFilter = req.query.source_filter as string | undefined;
    const skip = parseInt((req.query.skip as string) || '0', 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 1000);

    // Получаем все боты пользователя
    const userBots = await prisma.bot.findMany({
      where: { ownerId: userId },
    });

    const botIds = userBots.map((bot) => bot.id);

    if (botIds.length === 0) {
      return res.json([]);
    }

    // Запрос пользователей
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

    // Применяем фильтр по статусу
    if (statusFilter) {
      where.status = statusFilter;
    }

    // Применяем фильтр по источнику
    if (sourceFilter) {
      where.source = sourceFilter;
    }

    const users = await prisma.telegramUser.findMany({
      where,
      include: {
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      skip,
      take: limit,
    });

    // Добавляем информацию о боте к каждому пользователю
    const result = users.map((user) => {
      const bot = userBots.find((b) => b.id === user.botId);
      const botName = bot
        ? bot.name || bot.username || `Bot #${bot.id}`
        : null;

      return {
        id: user.id,
        bot_id: user.botId,
        bot_name: botName,
        telegram_user_id: Number(user.telegramUserId),
        username: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
        source: user.source,
        status: user.status,
        joined_at: user.joinedAt,
        last_activity: user.lastActivity,
        tags: user.tags,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('Error getting all users:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
