import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../core/database';
import { authenticateToken } from '../middleware/auth';
import { sendTelegramMessage } from '../utils/telegram';

const router = Router();

const updateSchema = z.object({
  error_notifications_enabled: z.boolean(),
  notify_bot_id: z.number().int().positive().nullable(),
  notify_telegram_user_id: z.number().int().positive().nullable(),
});

function serializeSettings(settings: {
  errorNotificationsEnabled: boolean;
  notifyBotId: number | null;
  notifyTelegramUserId: number | null;
  notifyBot?: { id: number; username: string | null; name: string | null } | null;
  notifyTelegramUser?: {
    id: number;
    telegramUserId: bigint;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}) {
  return {
    error_notifications_enabled: settings.errorNotificationsEnabled,
    notify_bot_id: settings.notifyBotId,
    notify_telegram_user_id: settings.notifyTelegramUserId,
    notify_bot: settings.notifyBot
      ? {
          id: settings.notifyBot.id,
          username: settings.notifyBot.username,
          name: settings.notifyBot.name,
        }
      : null,
    notify_telegram_user: settings.notifyTelegramUser
      ? {
          id: settings.notifyTelegramUser.id,
          telegram_user_id: settings.notifyTelegramUser.telegramUserId.toString(),
          username: settings.notifyTelegramUser.username,
          first_name: settings.notifyTelegramUser.firstName,
          last_name: settings.notifyTelegramUser.lastName,
        }
      : null,
  };
}

async function getOrCreateSettings(userId: number) {
  return prisma.userNotificationSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: {
      notifyBot: { select: { id: true, username: true, name: true } },
      notifyTelegramUser: {
        select: {
          id: true,
          telegramUserId: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/** GET /api/settings/notifications */
router.get('/notifications', authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const settings = await getOrCreateSettings(userId);
  res.json(serializeSettings(settings));
});

/** PUT /api/settings/notifications */
router.put('/notifications', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const body = updateSchema.parse(req.body);

    if (body.error_notifications_enabled) {
      if (!body.notify_bot_id || !body.notify_telegram_user_id) {
        res.status(400).json({
          detail: 'Для включения уведомлений выберите бота и получателя',
        });
        return;
      }
    }

    if (body.notify_bot_id) {
      const bot = await prisma.bot.findFirst({
        where: { id: body.notify_bot_id, ownerId: userId },
      });
      if (!bot) {
        res.status(400).json({ detail: 'Бот не найден или не принадлежит вам' });
        return;
      }
    }

    if (body.notify_telegram_user_id) {
      if (!body.notify_bot_id) {
        res.status(400).json({ detail: 'Сначала выберите бота' });
        return;
      }
      const tgUser = await prisma.telegramUser.findFirst({
        where: {
          id: body.notify_telegram_user_id,
          botId: body.notify_bot_id,
        },
      });
      if (!tgUser) {
        res.status(400).json({ detail: 'Получатель не найден у выбранного бота' });
        return;
      }
    }

    await getOrCreateSettings(userId);

    const settings = await prisma.userNotificationSettings.update({
      where: { userId },
      data: {
        errorNotificationsEnabled: body.error_notifications_enabled,
        notifyBotId: body.notify_bot_id,
        notifyTelegramUserId: body.notify_telegram_user_id,
      },
      include: {
        notifyBot: { select: { id: true, username: true, name: true } },
        notifyTelegramUser: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.json(serializeSettings(settings));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ detail: error.errors });
      return;
    }
    throw error;
  }
});

/** GET /api/settings/notifications/recipients?bot_id= */
router.get('/notifications/recipients', authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const botId = parseInt(String(req.query.bot_id || ''), 10);
  if (!Number.isFinite(botId) || botId <= 0) {
    res.status(400).json({ detail: 'bot_id обязателен' });
    return;
  }

  const bot = await prisma.bot.findFirst({
    where: { id: botId, ownerId: userId },
  });
  if (!bot) {
    res.status(404).json({ detail: 'Бот не найден' });
    return;
  }

  const users = await prisma.telegramUser.findMany({
    where: { botId, status: 'active' },
    orderBy: { lastActivity: 'desc' },
    take: 500,
    select: {
      id: true,
      telegramUserId: true,
      username: true,
      firstName: true,
      lastName: true,
      lastActivity: true,
    },
  });

  res.json(
    users.map((u) => ({
      id: u.id,
      telegram_user_id: u.telegramUserId.toString(),
      username: u.username,
      first_name: u.firstName,
      last_name: u.lastName,
      last_activity: u.lastActivity,
    }))
  );
});

/** POST /api/settings/notifications/test */
router.post('/notifications/test', authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const settings = await prisma.userNotificationSettings.findUnique({
    where: { userId },
    include: {
      notifyBot: { select: { id: true, token: true, ownerId: true } },
      notifyTelegramUser: {
        select: { telegramUserId: true, botId: true },
      },
    },
  });

  if (!settings?.notifyBot || !settings.notifyTelegramUser) {
    res.status(400).json({
      detail: 'Сначала сохраните бота и получателя в настройках',
    });
    return;
  }
  if (settings.notifyBot.ownerId !== userId) {
    res.status(400).json({ detail: 'Некорректные настройки бота' });
    return;
  }
  if (settings.notifyTelegramUser.botId !== settings.notifyBot.id) {
    res.status(400).json({ detail: 'Получатель не принадлежит выбранному боту' });
    return;
  }

  const result = await sendTelegramMessage(
    settings.notifyBot.token,
    settings.notifyTelegramUser.telegramUserId.toString(),
    '✅ GateGram: тестовое уведомление об ошибках настроено.'
  );

  if (!result.ok) {
    res.status(400).json({
      detail: result.description || 'Не удалось отправить сообщение. Получатель должен сначала написать боту.',
    });
    return;
  }

  res.json({ message: 'Тестовое уведомление отправлено' });
});

export default router;
