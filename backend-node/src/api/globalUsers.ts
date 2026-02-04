import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';

const router = express.Router();

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function makeExportFilename(prefix: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${prefix}_${yyyy}-${mm}-${dd}.csv`;
}

/**
 * GET /api/users
 * Получить всех пользователей всех ботов пользователя, с возможностью фильтрации
 */

/**
 * GET /api/users/export
 * Выгрузить пользователей в CSV (по фильтрам: bot_id/status_filter/source_filter)
 */
router.get('/export', authenticateToken, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const botId = req.query.bot_id ? parseInt(req.query.bot_id as string, 10) : undefined;
    const statusFilter = req.query.status_filter as string | undefined;
    const sourceFilter = req.query.source_filter as string | undefined;

    // Получаем все боты пользователя
    const userBots = await prisma.bot.findMany({
      where: { ownerId },
    });
    const botIds = userBots.map((bot) => bot.id);

    // Запрос пользователей
    const where: any = {
      botId: { in: botIds },
    };

    // Применяем фильтр по bot_id, если указан
    if (botId !== undefined) {
      if (!botIds.includes(botId)) {
        // Бот не принадлежит пользователю → отдаём пустой CSV
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${makeExportFilename('users')}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.write('\uFEFF');
        res.write('id,bot_id,bot_name,telegram_user_id,username,first_name,last_name,source,status,joined_at,last_activity,tags\n');
        res.end();
        return;
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

    const maxRows = parseInt(process.env.EXPORT_MAX_ROWS || '200000', 10);
    const total = botIds.length > 0 ? await prisma.telegramUser.count({ where }) : 0;
    if (Number.isFinite(maxRows) && maxRows > 0 && total > maxRows) {
      return res.status(413).json({
        detail: `Too many rows to export (${total}). Narrow filters or increase EXPORT_MAX_ROWS.`,
      });
    }

    const botNameById = new Map<number, string>();
    for (const b of userBots) {
      botNameById.set(b.id, b.name || b.username || `Bot #${b.id}`);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${makeExportFilename('users')}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.write('\uFEFF');
    res.write('id,bot_id,bot_name,telegram_user_id,username,first_name,last_name,source,status,joined_at,last_activity,tags\n');

    if (total === 0) {
      res.end();
      return;
    }

    const take = 5000;
    let lastId = 0;
    while (true) {
      const batch = await prisma.telegramUser.findMany({
        where: { ...where, id: { gt: lastId } },
        include: {
          tags: {
            select: { name: true },
          },
        },
        orderBy: { id: 'asc' },
        take,
      });

      if (batch.length === 0) break;

      for (const u of batch) {
        const row = [
          u.id,
          u.botId,
          botNameById.get(u.botId) || '',
          u.telegramUserId.toString(),
          u.username || '',
          u.firstName || '',
          u.lastName || '',
          u.source || '',
          u.status,
          u.joinedAt?.toISOString?.() ? u.joinedAt.toISOString() : String(u.joinedAt),
          u.lastActivity?.toISOString?.() ? u.lastActivity.toISOString() : String(u.lastActivity),
          (u.tags || []).map((t) => t.name).join(';'),
        ]
          .map(csvEscape)
          .join(',');

        res.write(row + '\n');
      }

      lastId = batch[batch.length - 1].id;
      if (batch.length < take) break;
    }

    res.end();
  } catch (error) {
    console.error('Error exporting users:', error);
    if (!res.headersSent) {
      return res.status(500).json({ detail: 'Internal server error' });
    }
    try {
      res.end();
    } catch {
      // ignore
    }
  }
});

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
