import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';

const router = express.Router();

/**
 * GET /api/analytics/overview
 * Получить общую аналитику
 */
router.get('/overview', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const days = parseInt((req.query.days as string) || '30', 10);

    if (days < 1 || days > 365) {
      return res.status(400).json({ detail: 'Days must be between 1 and 365' });
    }

    // Получаем все боты пользователя
    const userBots = await prisma.bot.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    const botIds = userBots.map((bot) => bot.id);

    if (botIds.length === 0) {
      return res.json({
        total_bots: 0,
        total_users: 0,
        active_users: 0,
        total_broadcasts: 0,
        successful_broadcasts: 0,
        users_today: 0,
        users_this_week: 0,
        users_this_month: 0,
        users_by_day: [],
        users_by_source: [],
      });
    }

    // Общая статистика
    const totalUsers = await prisma.telegramUser.count({
      where: { botId: { in: botIds } },
    });

    const activeUsers = await prisma.telegramUser.count({
      where: {
        botId: { in: botIds },
        status: 'active',
      },
    });

    // Считаем рассылки через боты пользователя
    const totalBroadcasts = await prisma.broadcast.count({
      where: { botId: { in: botIds } },
    });

    const successfulBroadcasts = await prisma.broadcast.count({
      where: {
        botId: { in: botIds },
        status: 'completed',
      },
    });

    // Статистика по времени
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const usersToday = await prisma.telegramUser.count({
      where: {
        botId: { in: botIds },
        joinedAt: { gte: todayStart },
      },
    });

    const usersThisWeek = await prisma.telegramUser.count({
      where: {
        botId: { in: botIds },
        joinedAt: { gte: weekStart },
      },
    });

    const usersThisMonth = await prisma.telegramUser.count({
      where: {
        botId: { in: botIds },
        joinedAt: { gte: monthStart },
      },
    });

    // Статистика по дням
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);

    // Используем Prisma для группировки по дням
    const allUsers = await prisma.telegramUser.findMany({
      where: {
        botId: { in: botIds },
        joinedAt: { gte: startDate },
      },
      select: { joinedAt: true },
    });

    // Группируем по дням вручную
    const usersByDayMap = new Map<string, number>();
    for (const user of allUsers) {
      const dateKey = user.joinedAt.toISOString().split('T')[0];
      usersByDayMap.set(dateKey, (usersByDayMap.get(dateKey) || 0) + 1);
    }

    const usersByDay = Array.from(usersByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Статистика по источникам
    const allUsersForSource = await prisma.telegramUser.findMany({
      where: { botId: { in: botIds } },
      select: { source: true, status: true },
    });

    // Группируем по источникам
    const sourceStatsMap = new Map<string, { total: number; active: number }>();
    for (const user of allUsersForSource) {
      const source = user.source || 'unknown';
      const stats = sourceStatsMap.get(source) || { total: 0, active: 0 };
      stats.total++;
      if (user.status === 'active') {
        stats.active++;
      }
      sourceStatsMap.set(source, stats);
    }

    const usersBySource = Array.from(sourceStatsMap.entries()).map(([source, stats]) => ({
      source,
      total_users: stats.total,
      active_users: stats.active,
      conversion_rate: stats.total > 0 ? (stats.active / stats.total) * 100 : 0,
    }));

    return res.json({
      total_bots: userBots.length,
      total_users: totalUsers,
      active_users: activeUsers,
      total_broadcasts: totalBroadcasts,
      successful_broadcasts: successfulBroadcasts,
      users_today: usersToday,
      users_this_week: usersThisWeek,
      users_this_month: usersThisMonth,
      users_by_day: usersByDay,
      users_by_source: usersBySource,
    });
  } catch (error) {
    console.error('Error getting analytics overview:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/bots/:botId/stats
 * Получить статистику по конкретному боту
 */
router.get('/bots/:botId/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);

    if (isNaN(botId)) {
      return res.status(400).json({ detail: 'Invalid bot ID' });
    }

    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        ownerId: userId,
      },
    });

    if (!bot) {
      return res.status(404).json({ detail: 'Bot not found' });
    }

    // Общая статистика
    const totalUsers = await prisma.telegramUser.count({
      where: { botId },
    });

    const activeUsers = await prisma.telegramUser.count({
      where: {
        botId,
        status: 'active',
      },
    });

    const blockedUsers = await prisma.telegramUser.count({
      where: {
        botId,
        status: 'blocked',
      },
    });

    // Статистика по источникам
    const allUsersForSource = await prisma.telegramUser.findMany({
      where: { botId },
      select: { source: true },
    });

    const usersBySource: Record<string, number> = {};
    for (const user of allUsersForSource) {
      const source = user.source || 'unknown';
      usersBySource[source] = (usersBySource[source] || 0) + 1;
    }

    // Статистика по времени
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const usersToday = await prisma.telegramUser.count({
      where: {
        botId,
        joinedAt: { gte: todayStart },
      },
    });

    const usersThisWeek = await prisma.telegramUser.count({
      where: {
        botId,
        joinedAt: { gte: weekStart },
      },
    });

    const usersThisMonth = await prisma.telegramUser.count({
      where: {
        botId,
        joinedAt: { gte: monthStart },
      },
    });

    return res.json({
      bot_id: bot.id,
      bot_name: bot.name,
      total_users: totalUsers,
      active_users: activeUsers,
      blocked_users: blockedUsers,
      users_by_source: usersBySource,
      users_today: usersToday,
      users_this_week: usersThisWeek,
      users_this_month: usersThisMonth,
    });
  } catch (error) {
    console.error('Error getting bot stats:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/bots/:botId/funnel
 * Получить воронку конверсии для бота
 */
router.get('/bots/:botId/funnel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);

    if (isNaN(botId)) {
      return res.status(400).json({ detail: 'Invalid bot ID' });
    }

    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        ownerId: userId,
      },
    });

    if (!bot) {
      return res.status(404).json({ detail: 'Bot not found' });
    }

    // Шаги воронки
    const totalStarted = await prisma.telegramUser.count({
      where: { botId },
    });

    const activeUsers = await prisma.telegramUser.count({
      where: {
        botId,
        status: 'active',
      },
    });

    // Пользователи, которые взаимодействовали (упрощенная логика)
    const interacted = activeUsers;

    const funnel = [
      {
        step: 'started',
        count: totalStarted,
        percentage: 100.0,
      },
      {
        step: 'active',
        count: activeUsers,
        percentage: totalStarted > 0 ? (activeUsers / totalStarted) * 100 : 0,
      },
      {
        step: 'interacted',
        count: interacted,
        percentage: totalStarted > 0 ? (interacted / totalStarted) * 100 : 0,
      },
    ];

    return res.json(funnel);
  } catch (error) {
    console.error('Error getting conversion funnel:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/bots/comparison
 * Сравнить все боты пользователя
 */
router.get('/bots/comparison', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const bots = await prisma.bot.findMany({
      where: { ownerId: userId },
    });

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const comparison = await Promise.all(
      bots.map(async (bot) => {
        const totalUsers = await prisma.telegramUser.count({
          where: { botId: bot.id },
        });

        const activeUsers = await prisma.telegramUser.count({
          where: {
            botId: bot.id,
            status: 'active',
          },
        });

        const usersToday = await prisma.telegramUser.count({
          where: {
            botId: bot.id,
            joinedAt: { gte: todayStart },
          },
        });

        const usersThisWeek = await prisma.telegramUser.count({
          where: {
            botId: bot.id,
            joinedAt: { gte: weekStart },
          },
        });

        const usersThisMonth = await prisma.telegramUser.count({
          where: {
            botId: bot.id,
            joinedAt: { gte: monthStart },
          },
        });

        const conversionRate =
          totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

        return {
          bot_id: bot.id,
          bot_name: bot.name,
          total_users: totalUsers,
          active_users: activeUsers,
          conversion_rate: conversionRate,
          users_today: usersToday,
          users_this_week: usersThisWeek,
          users_this_month: usersThisMonth,
        };
      })
    );

    return res.json(comparison);
  } catch (error) {
    console.error('Error comparing bots:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
