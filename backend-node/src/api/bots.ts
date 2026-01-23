import express, { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { InputFile } from 'grammy';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';
import {
  validateTelegramToken,
  normalizeChannelUrl,
  getChannelInfo,
} from '../utils/telegram';
import { botManager } from '../services/botManager';

const router = express.Router();

// Multer (in-memory) for personal message media
const personalMessageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

function normalizeUploadFilename(name: string | undefined): string {
  const fallback = 'file';
  if (!name) return fallback;
  const trimmed = String(name).trim();
  if (!trimmed) return fallback;

  // Частая проблема: имя файла в multipart приходит как latin1, хотя это UTF-8 байты.
  // Тогда кириллица превращается в "Ð…".
  // Пытаемся восстановить: latin1 -> utf8.
  try {
    const decoded = Buffer.from(trimmed, 'latin1').toString('utf8');
    // Простейшая эвристика: если было много "Ð/Ñ" и после декодирования появилась кириллица — используем decoded.
    const looksMojibake = /[ÐÑ]/.test(trimmed);
    const hasCyrillic = /[А-Яа-яЁё]/.test(decoded);
    if (looksMojibake && hasCyrillic) return decoded;
    return trimmed;
  } catch {
    return trimmed;
  }
}

// Схемы валидации
const ChannelSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string(),
});

const TokenValidateRequestSchema = z.object({
  token: z.string().min(1),
});

const BotCreateSchema = z.object({
  token: z.string().min(1),
  name: z.string().optional(),
  welcome_message: z.string().optional(),
  required_interaction: z.boolean().default(true),
  interaction_delay_seconds: z.number().int().min(0).max(300).default(5),
  continue_button_text: z.string().default('✅ Продолжить'),
  channel_link: z.string().optional(),
  channels: z.array(ChannelSchema).default([]),
  settings: z.record(z.any()).optional(),
});

const BotUpdateSchema = z.object({
  name: z.string().optional(),
  is_active: z.boolean().optional(),
  welcome_message: z.string().optional(),
  required_interaction: z.boolean().optional(),
  interaction_delay_seconds: z.number().int().min(0).max(300).optional(),
  continue_button_text: z.string().optional(),
  channel_link: z.string().optional(),
  channels: z.array(ChannelSchema).optional(),
  settings: z.record(z.any()).optional(),
});

const BlockUserRequestSchema = z.object({
  blocked: z.boolean().default(true),
});

/**
 * GET /api/bots/channel-info
 * Получить информацию о канале по URL или username
 */
router.get(
  '/channel-info',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ detail: 'URL parameter is required' });
      }

      // Декодируем URL если он был закодирован
      const decodedUrl = decodeURIComponent(url);
      const normalizedUrl = normalizeChannelUrl(decodedUrl);
      const channelName = await getChannelInfo(decodedUrl);

      return res.json({
        name: channelName,
        normalized_url: normalizedUrl,
      });
    } catch (error) {
      console.error('Error getting channel info:', error);
      const url = req.query.url as string;
      try {
        const decodedUrl = decodeURIComponent(url);
        const normalizedUrl = normalizeChannelUrl(decodedUrl);
        return res.json({
          name: null,
          normalized_url: normalizedUrl,
        });
      } catch {
        return res.json({
          name: null,
          normalized_url: url,
        });
      }
    }
  }
);

/**
 * GET /api/bots
 * Получить список всех ботов пользователя
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const bots = await prisma.bot.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        username: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Преобразуем isActive в is_active для совместимости с фронтендом
    const result = bots.map(bot => ({
      ...bot,
      is_active: bot.isActive,
    }));

    return res.json(result);
  } catch (error) {
    console.error('Error getting bots:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/bots/:botId
 * Получить информацию о конкретном боте
 */
router.get('/:botId', authenticateToken, async (req: Request, res: Response) => {
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

    // Преобразуем isActive в is_active для совместимости с фронтендом
    return res.json({
      ...bot,
      is_active: bot.isActive,
    });
  } catch (error) {
    console.error('Error getting bot:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/bots
 * Создать нового бота
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const body = BotCreateSchema.parse(req.body);

    // Проверяем, существует ли бот с таким токеном
    const existingBot = await prisma.bot.findUnique({
      where: { token: body.token },
    });

    if (existingBot) {
      return res.status(400).json({
        detail: 'Bot with this token already exists',
      });
    }

    // Валидируем токен через Telegram API
    const botInfo = await validateTelegramToken(body.token);
    if (!botInfo) {
      return res.status(400).json({
        detail: 'Invalid Telegram bot token',
      });
    }

    // Подготавливаем каналы
    let channelsData: Array<{ name: string; url: string }> = [];
    if (body.channels && body.channels.length > 0) {
      channelsData = body.channels.map((ch) => ({
        name: ch.name,
        url: normalizeChannelUrl(ch.url),
      }));
    } else if (body.channel_link) {
      channelsData = [
        {
          name: 'Канал',
          url: normalizeChannelUrl(body.channel_link),
        },
      ];
    }

    // Создаем бота
    const newBot = await prisma.bot.create({
      data: {
        ownerId: userId,
        token: body.token,
        username: botInfo.username || null,
        name: body.name || botInfo.first_name || null,
        isActive: true,
        welcomeMessage: body.welcome_message || null,
        requiredInteraction: body.required_interaction,
        interactionDelaySeconds: body.interaction_delay_seconds,
        continueButtonText: body.continue_button_text,
        channelLink: body.channel_link || null,
        channels: channelsData as any,
        settings: (body.settings || {}) as any,
      },
    });

    // Запускаем бота, если он активен
    if (newBot.isActive) {
      await botManager.startBot(newBot.id, newBot.token);
    }

    // Преобразуем isActive в is_active для совместимости с фронтендом
    return res.status(201).json({
      ...newBot,
      is_active: newBot.isActive,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error creating bot:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * PUT /api/bots/:botId
 * Обновить информацию о боте
 */
router.put('/:botId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);

    if (isNaN(botId)) {
      return res.status(400).json({ detail: 'Invalid bot ID' });
    }

    const body = BotUpdateSchema.parse(req.body);

    // Проверяем, что бот принадлежит пользователю
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        ownerId: userId,
      },
    });

    if (!bot) {
      return res.status(404).json({ detail: 'Bot not found' });
    }

    // Сохраняем старое состояние is_active
    const oldIsActive = bot.isActive;

    // Подготавливаем данные для обновления
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.is_active !== undefined) updateData.isActive = body.is_active;
    if (body.welcome_message !== undefined)
      updateData.welcomeMessage = body.welcome_message;
    if (body.required_interaction !== undefined)
      updateData.requiredInteraction = body.required_interaction;
    if (body.interaction_delay_seconds !== undefined)
      updateData.interactionDelaySeconds = body.interaction_delay_seconds;
    if (body.continue_button_text !== undefined)
      updateData.continueButtonText = body.continue_button_text;
    if (body.channel_link !== undefined)
      updateData.channelLink = body.channel_link;
    if (body.settings !== undefined) updateData.settings = body.settings;

    // Обрабатываем channels отдельно
    if (body.channels !== undefined) {
      const channelsData: Array<{ name: string; url: string }> = [];
      for (const ch of body.channels) {
        const chName = (ch.name || '').trim();
        const chUrl = (ch.url || '').trim();
        if (chName && chUrl) {
          channelsData.push({
            name: chName,
            url: normalizeChannelUrl(chUrl),
          });
        }
      }
      // Если есть старый channel_link и его нет в channels, добавляем
      if (bot.channelLink) {
        const normalizedLink = normalizeChannelUrl(bot.channelLink as string);
        if (
          !channelsData.some((ch) => ch.url === normalizedLink)
        ) {
          channelsData.push({
            name: 'Канал',
            url: normalizedLink,
          });
        }
      }
      updateData.channels = channelsData as any;
    }

    // Обновляем бота
    const updatedBot = await prisma.bot.update({
      where: { id: botId },
      data: updateData,
    });

    // Управляем запуском/остановкой бота
    const isRunning = botManager.isRunning(botId);

    if (updatedBot.isActive && !isRunning) {
      // Запускаем бота
      console.log(`Starting bot ${botId} after update`);
      await botManager.startBot(botId, updatedBot.token);
    } else if (!updatedBot.isActive && isRunning) {
      // Останавливаем бота
      console.log(`Stopping bot ${botId} after update`);
      await botManager.stopBot(botId);
    } else if (
      updatedBot.isActive &&
      isRunning &&
      oldIsActive !== updatedBot.isActive
    ) {
      // Перезапускаем бота при изменении настроек
      console.log(`Restarting bot ${botId} after update`);
      await botManager.restartBot(botId, updatedBot.token);
    }

    // Преобразуем isActive в is_active для совместимости с фронтендом
    return res.json({
      ...updatedBot,
      is_active: updatedBot.isActive,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error updating bot:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * DELETE /api/bots/:botId
 * Удалить бота
 */
router.delete('/:botId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);

    if (isNaN(botId)) {
      return res.status(400).json({ detail: 'Invalid bot ID' });
    }

    // Проверяем, что бот принадлежит пользователю
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        ownerId: userId,
      },
    });

    if (!bot) {
      return res.status(404).json({ detail: 'Bot not found' });
    }

    // Останавливаем бота, если он запущен
    if (botManager.isRunning(botId)) {
      await botManager.stopBot(botId);
    }

    // Удаляем бота
    await prisma.bot.delete({
      where: { id: botId },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting bot:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/bots/:botId/start
 * Запустить бота
 */
router.post('/:botId/start', authenticateToken, async (req: Request, res: Response) => {
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

    if (botManager.isRunning(botId)) {
      return res.status(400).json({ detail: 'Bot is already running' });
    }

    const success = await botManager.startBot(botId, bot.token);

    if (success) {
      await prisma.bot.update({
        where: { id: botId },
        data: { isActive: true },
      });
      return res.json({ message: 'Bot started successfully' });
    } else {
      return res.status(500).json({ detail: 'Failed to start bot' });
    }
  } catch (error) {
    console.error('Error starting bot:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/bots/:botId/stop
 * Остановить бота
 */
router.post('/:botId/stop', authenticateToken, async (req: Request, res: Response) => {
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

    if (!botManager.isRunning(botId)) {
      return res.status(400).json({ detail: 'Bot is not running' });
    }

    const success = await botManager.stopBot(botId);

    if (success) {
      await prisma.bot.update({
        where: { id: botId },
        data: { isActive: false },
      });
      return res.json({ message: 'Bot stopped successfully' });
    } else {
      return res.status(500).json({ detail: 'Failed to stop bot' });
    }
  } catch (error) {
    console.error('Error stopping bot:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/bots/:botId/users
 * Получить список пользователей бота
 */
router.get('/:botId/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);

    if (isNaN(botId)) {
      return res.status(400).json({ detail: 'Invalid bot ID' });
    }

    const statusFilter = req.query.status_filter as string | undefined;
    const sourceFilter = req.query.source_filter as string | undefined;
    const skip = parseInt((req.query.skip as string) || '0', 10);
    const limit = Math.min(
      parseInt((req.query.limit as string) || '100', 10),
      1000
    );

    // Проверяем, что бот принадлежит пользователю
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        ownerId: userId,
      },
    });

    if (!bot) {
      return res.status(404).json({ detail: 'Bot not found' });
    }

    // Запрос пользователей
    const where: any = { botId };
    if (statusFilter) {
      where.status = statusFilter;
    }
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

    // Преобразуем в ответы с тегами
    const result = users.map((user) => ({
      id: user.id,
      bot_id: user.botId,
      telegram_user_id: Number(user.telegramUserId),
      username: user.username,
      first_name: user.firstName,
      last_name: user.lastName,
      source: user.source,
      status: user.status,
      joined_at: user.joinedAt,
      last_activity: user.lastActivity,
      tags: user.tags,
    }));

    return res.json(result);
  } catch (error) {
    console.error('Error getting bot users:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/bots/:botId/users/:userId/block
 * Заблокировать или разблокировать пользователя
 */
router.post(
  '/:botId/users/:userId/block',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const botId = parseInt(req.params.botId, 10);
      const telegramUserId = parseInt(req.params.userId, 10);

      if (isNaN(botId) || isNaN(telegramUserId)) {
        return res.status(400).json({ detail: 'Invalid bot ID or user ID' });
      }

      const body = BlockUserRequestSchema.parse(req.body);

      // Проверяем, что бот принадлежит пользователю
      const bot = await prisma.bot.findFirst({
        where: {
          id: botId,
          ownerId: userId,
        },
      });

      if (!bot) {
        return res.status(404).json({ detail: 'Bot not found' });
      }

      // Проверяем, что пользователь принадлежит этому боту
      const user = await prisma.telegramUser.findFirst({
        where: {
          id: telegramUserId,
          botId: botId,
        },
      });

      if (!user) {
        return res.status(404).json({ detail: 'User not found' });
      }

      // Обновляем статус
      const newStatus = body.blocked ? 'blocked' : 'active';
      const updatedUser = await prisma.telegramUser.update({
        where: { id: telegramUserId },
        data: { status: newStatus },
        include: {
          tags: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      console.log(
        `User ${updatedUser.telegramUserId} status changed to ${newStatus} by user ${userId}`
      );

      return res.json({
        id: updatedUser.id,
        bot_id: updatedUser.botId,
        telegram_user_id: Number(updatedUser.telegramUserId),
        username: updatedUser.username,
        first_name: updatedUser.firstName,
        last_name: updatedUser.lastName,
        source: updatedUser.source,
        status: updatedUser.status,
        joined_at: updatedUser.joinedAt,
        last_activity: updatedUser.lastActivity,
        tags: updatedUser.tags,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({ detail: error.errors });
      }
      console.error('Error blocking user:', error);
      return res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

/**
 * POST /api/bots/:botId/users/:userId/send-message
 * Отправить личное сообщение пользователю (текст + опционально медиа до 50MB)
 *
 * multipart/form-data:
 * - message_text: string
 * - media_type?: photo|video|audio|document
 * - media_file?: file
 */
router.post(
  '/:botId/users/:userId/send-message',
  authenticateToken,
  personalMessageUpload.single('media_file'),
  async (req: Request, res: Response) => {
    try {
      const ownerId = req.user!.userId;
      const botId = parseInt(req.params.botId, 10);
      const telegramUserRowId = parseInt(req.params.userId, 10);

      if (isNaN(botId) || isNaN(telegramUserRowId)) {
        return res.status(400).json({ detail: 'Invalid bot ID or user ID' });
      }

      const messageText = (req.body?.message_text ?? '').toString();
      const requestedMediaType = (req.body?.media_type ?? '').toString();
      const file = (req as any).file as Express.Multer.File | undefined;

      if (!messageText.trim() && !file) {
        return res.status(400).json({ detail: 'message_text or media_file is required' });
      }

      // Проверяем, что бот принадлежит пользователю
      const bot = await prisma.bot.findFirst({
        where: { id: botId, ownerId },
      });
      if (!bot) {
        return res.status(404).json({ detail: 'Bot not found' });
      }

      // Проверяем, что пользователь принадлежит этому боту
      const user = await prisma.telegramUser.findFirst({
        where: { id: telegramUserRowId, botId },
      });
      if (!user) {
        return res.status(404).json({ detail: 'User not found' });
      }

      const chatIdNum = Number(user.telegramUserId);
      if (!Number.isFinite(chatIdNum) || chatIdNum <= 0) {
        return res.status(500).json({ detail: 'Invalid telegram user id' });
      }

      // Получаем (или запускаем) экземпляр бота
      let botInstance = botManager.getBot(botId);
      if (!botInstance) {
        const started = await botManager.startBot(botId, bot.token);
        if (!started) {
          return res.status(500).json({ detail: 'Bot is not running and could not be started' });
        }
        botInstance = botManager.getBot(botId);
      }
      if (!botInstance) {
        return res.status(500).json({ detail: 'Bot instance not available' });
      }

      // Отправляем сообщение
      let result: any = null;
      if (file) {
        const inferredType =
          file.mimetype?.startsWith('image/') ? 'photo' :
          file.mimetype?.startsWith('video/') ? 'video' :
          file.mimetype?.startsWith('audio/') ? 'audio' :
          'document';
        const mediaType = (requestedMediaType || inferredType).toLowerCase();
        const safeFilename = normalizeUploadFilename(file.originalname);
        const input = new InputFile(file.buffer, safeFilename);
        const caption = messageText?.trim() ? messageText : undefined;

        if (mediaType === 'photo') {
          result = await botInstance.api.sendPhoto(chatIdNum, input, { caption });
        } else if (mediaType === 'video') {
          result = await botInstance.api.sendVideo(chatIdNum, input, { caption });
        } else if (mediaType === 'audio') {
          result = await botInstance.api.sendAudio(chatIdNum, input, { caption });
        } else {
          result = await botInstance.api.sendDocument(chatIdNum, input, { caption });
        }
      } else {
        result = await botInstance.api.sendMessage(chatIdNum, messageText);
      }

      return res.json({
        message: 'Message sent',
        message_id: result?.message_id ?? null,
      });
    } catch (error: any) {
      console.error('Error sending personal message:', error);
      // grammY errors часто содержат description
      const detail = error?.description || error?.message || 'Internal server error';
      return res.status(500).json({ detail });
    }
  }
);

/**
 * POST /api/bots/validate-token
 * Валидировать токен бота и получить информацию о нем
 */
router.post(
  '/validate-token',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const body = TokenValidateRequestSchema.parse(req.body);
      const botInfo = await validateTelegramToken(body.token);

      if (!botInfo) {
        return res.status(400).json({
          detail: 'Invalid Telegram bot token',
        });
      }

      return res.json({
        username: botInfo.username,
        first_name: botInfo.first_name,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({ detail: error.errors });
      }
      console.error('Error validating token:', error);
      return res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

export default router;
