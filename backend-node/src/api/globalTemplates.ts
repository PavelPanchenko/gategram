import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';

const router = express.Router();

/**
 * GET /api/templates
 * Получить все шаблоны (с опциональным фильтром по боту)
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

    // Запрос шаблонов
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

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Добавляем информацию о боте к каждому шаблону
    const result = templates.map((template) => {
      const bot = userBots.find((b) => b.id === template.botId);
      const botName = bot
        ? bot.name || bot.username || `Bot #${bot.id}`
        : null;

      return {
        id: template.id,
        bot_id: template.botId,
        name: template.name,
        content: template.content,
        variables: template.variables as any,
        is_active: template.isActive,
        created_at: template.createdAt,
        updated_at: template.updatedAt,
        bot_name: botName,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('Error getting all templates:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
