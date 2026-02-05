import express, { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';
import { filterUsersForBroadcast, BroadcastFilters } from '../utils/broadcastFilters';

const router = express.Router();

// Создаем папку для медиа файлов
// Используем путь относительно проекта или из переменной окружения
const getMediaDir = () => {
  if (process.env.MEDIA_DIR) {
    return process.env.MEDIA_DIR;
  }
  // По умолчанию храним медиа внутри backend-node
  const projectRoot = process.cwd();
  return path.join(projectRoot, 'media', 'broadcasts');
};

const MEDIA_DIR = getMediaDir();
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MEDIA_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Функция для определения типа медиа по расширению
function getMediaType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    return 'photo';
  }
  if (['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext)) {
    return 'video';
  }
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
    return 'audio';
  }
  return 'document';
}

// Функция для удаления медиа файла
function deleteMediaFile(mediaUrl: string | null): boolean {
  if (!mediaUrl) return false;

  try {
    const possiblePaths = [
      mediaUrl,
      path.resolve(mediaUrl),
      path.join(MEDIA_DIR, path.basename(mediaUrl)),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        return true;
      }
    }

    console.warn(`Media file not found for deletion: ${mediaUrl}`);
    return false;
  } catch (error) {
    console.error(`Error deleting media file ${mediaUrl}:`, error);
    return false;
  }
}

function deleteMediaFilesList(mediaFiles: unknown): void {
  const list = (mediaFiles as Array<{ url?: string }> | null) || [];
  if (!Array.isArray(list)) return;
  for (const item of list) {
    if (item?.url) {
      deleteMediaFile(item.url);
    }
  }
}

// Схемы валидации
const BroadcastCreateSchema = z.object({
  bot_id: z.number().int(),
  message_text: z.string().min(1).max(4096),
  template_id: z.number().int().optional(),
  scheduled_at: z.string().optional(),
  filters: z.string().optional(), // JSON строка
});

/**
 * GET /api/broadcasts
 * Получить список рассылок
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = req.query.bot_id ? parseInt(req.query.bot_id as string, 10) : undefined;
    const statusFilter = req.query.status_filter as string | undefined;
    const skip = parseInt((req.query.skip as string) || '0', 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 1000);
    const includeTotal =
      req.query.include_total === '1' ||
      req.query.include_total === 'true';

    const where: any = {
      ownerId: userId,
    };

    if (botId) {
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

      where.botId = botId;
    }

    if (statusFilter) {
      where.status = statusFilter;
    }

    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      includeTotal ? prisma.broadcast.count({ where }) : Promise.resolve(0),
    ]);

    const result = broadcasts.map((broadcast) => ({
      id: broadcast.id,
      bot_id: broadcast.botId,
      message_text: broadcast.messageText,
      media_type: broadcast.mediaType,
      media_url: broadcast.mediaUrl,
      status: broadcast.status,
      scheduled_at: broadcast.scheduledAt,
      total_users: broadcast.totalUsers,
      sent_count: broadcast.sentCount,
      failed_count: broadcast.failedCount,
      filters: broadcast.filters as any,
      created_at: broadcast.createdAt,
    }));

    return res.json(includeTotal ? { items: result, total, skip, limit } : result);
  } catch (error) {
    console.error('Error getting broadcasts:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/broadcasts/:broadcastId
 * Получить информацию о рассылке
 */
router.get('/:broadcastId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const broadcastId = parseInt(req.params.broadcastId, 10);

    if (isNaN(broadcastId)) {
      return res.status(400).json({ detail: 'Invalid broadcast ID' });
    }

    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: broadcastId,
        ownerId: userId,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ detail: 'Broadcast not found' });
    }

    return res.json({
      id: broadcast.id,
      bot_id: broadcast.botId,
      owner_id: broadcast.ownerId,
      message_text: broadcast.messageText,
      template_id: broadcast.templateId,
      media_type: broadcast.mediaType,
      media_url: broadcast.mediaUrl,
      media_files: broadcast.mediaFiles as any,
      status: broadcast.status,
      scheduled_at: broadcast.scheduledAt,
      started_at: broadcast.startedAt,
      completed_at: broadcast.completedAt,
      total_users: broadcast.totalUsers,
      sent_count: broadcast.sentCount,
      failed_count: broadcast.failedCount,
      filters: broadcast.filters as any,
      created_at: broadcast.createdAt,
    });
  } catch (error) {
    console.error('Error getting broadcast:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/broadcasts
 * Создать новую рассылку с возможностью загрузки медиа файла
 */
router.post(
  '/',
  authenticateToken,
  upload.fields([
    { name: 'media_file', maxCount: 1 },
    { name: 'media_files', maxCount: 10 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const body = BroadcastCreateSchema.parse({
        bot_id: parseInt(req.body.bot_id, 10),
        message_text: req.body.message_text,
        template_id: req.body.template_id ? parseInt(req.body.template_id, 10) : undefined,
        scheduled_at: req.body.scheduled_at,
        filters: req.body.filters,
      });

      // Валидация message_text
      if (!body.message_text || body.message_text.trim().length === 0) {
        return res.status(422).json({
          detail: 'message_text is required and cannot be empty',
        });
      }

      if (body.message_text.length > 4096) {
        return res.status(422).json({
          detail: 'message_text cannot exceed 4096 characters',
        });
      }

      // Проверяем, что бот принадлежит пользователю
      const bot = await prisma.bot.findFirst({
        where: {
          id: body.bot_id,
          ownerId: userId,
        },
      });

      if (!bot) {
        return res.status(404).json({ detail: 'Bot not found' });
      }

      if (!bot.isActive) {
        return res.status(400).json({ detail: 'Bot is not active' });
      }

      // Парсим фильтры
      let filtersDict: BroadcastFilters | undefined;
      if (body.filters) {
        try {
          filtersDict = JSON.parse(body.filters);
        } catch {
          return res.status(400).json({ detail: 'Invalid filters JSON format' });
        }
      }

      // Подсчитываем количество пользователей для рассылки с учетом фильтров
      const filteredUserIds = await filterUsersForBroadcast(
        bot.id,
        filtersDict || {}
      );

      if (filteredUserIds.length === 0) {
        return res.status(400).json({
          detail: 'No users match the specified filters for this bot',
        });
      }

      // Обрабатываем загруженные файлы
      let mediaUrl: string | null = null;
      let finalMediaType: string | null = null;
      let mediaFilesList: Array<{ type: string; url: string }> = [];

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Обрабатываем множественные файлы (приоритет над одиночным файлом)
      if (files.media_files && files.media_files.length > 0) {
        const filesToProcess = files.media_files.slice(0, 10); // Максимум 10 файлов

        for (const file of filesToProcess) {
          const filePath = path.join(MEDIA_DIR, file.filename);
          const mediaType = getMediaType(file.originalname);

          mediaFilesList.push({
            type: mediaType,
            url: filePath,
          });
        }
      }
      // Обрабатываем одиночный файл (для обратной совместимости)
      else if (files.media_file && files.media_file.length > 0) {
        const file = files.media_file[0];
        const filePath = path.join(MEDIA_DIR, file.filename);
        finalMediaType = getMediaType(file.originalname);
        mediaUrl = filePath;
      }

      // Парсим scheduled_at если есть
      let scheduledDatetime: Date | null = null;
      if (body.scheduled_at) {
        try {
          // Нормализуем формат: убираем миллисекунды и обрабатываем Z
          let normalized = body.scheduled_at.trim();

          // Убираем миллисекунды если есть
          normalized = normalized.replace(/\.\d+(?=[Z+])/, '');

          // Заменяем Z на +00:00 для правильного парсинга
          if (normalized.endsWith('Z')) {
            normalized = normalized.replace('Z', '+00:00');
          }

          // Если нет таймзоны, добавляем UTC
          if (normalized.includes('T') && !normalized.includes('+') && !normalized.includes('-', 10)) {
            const parts = normalized.split('T');
            if (parts.length === 2) {
              const datePart = parts[0];
              let timePart = parts[1];
              // Добавляем секунды если их нет
              if (timePart.split(':').length === 2) {
                timePart = timePart + ':00';
              }
              normalized = `${datePart}T${timePart}+00:00`;
            }
          }

          scheduledDatetime = new Date(normalized);

          if (isNaN(scheduledDatetime.getTime())) {
            throw new Error('Invalid date');
          }
        } catch (error) {
          return res.status(400).json({
            detail: `Invalid scheduled_at format: ${body.scheduled_at}. Expected ISO format (e.g., 2026-01-09T23:50:00Z or 2026-01-09T23:50:00+00:00)`,
          });
        }
      }

      // Определяем статус
      const broadcastStatus = scheduledDatetime ? 'scheduled' : 'pending';

      // Проверяем template_id, если указан
      let templateIdValue: number | null = null;
      if (body.template_id) {
        const template = await prisma.messageTemplate.findFirst({
          where: {
            id: body.template_id,
            botId: body.bot_id,
            isActive: true,
          },
        });

        if (!template) {
          return res.status(404).json({ detail: 'Template not found or inactive' });
        }

        templateIdValue = body.template_id;
      }

      // Создаем рассылку
      const broadcast = await prisma.broadcast.create({
        data: {
          botId: body.bot_id,
          ownerId: userId,
          messageText: body.message_text,
          templateId: templateIdValue,
          mediaType: finalMediaType,
          mediaUrl: mediaUrl,
          mediaFiles: mediaFilesList.length > 0 ? (mediaFilesList as any) : null,
          status: broadcastStatus,
          scheduledAt: scheduledDatetime,
          totalUsers: filteredUserIds.length,
          filters: (filtersDict || {}) as any,
        },
      });

      // Запускаем задачу для отправки через очередь
      if (broadcastStatus === 'pending') {
        const { broadcastQueue } = await import('../queues/broadcastQueue');
        await broadcastQueue.add('send-broadcast', { broadcastId: broadcast.id });
      }

      return res.status(201).json({
        id: broadcast.id,
        bot_id: broadcast.botId,
        owner_id: broadcast.ownerId,
        message_text: broadcast.messageText,
        template_id: broadcast.templateId,
        media_type: broadcast.mediaType,
        media_url: broadcast.mediaUrl,
        media_files: broadcast.mediaFiles as any,
        status: broadcast.status,
        scheduled_at: broadcast.scheduledAt,
        started_at: broadcast.startedAt,
        completed_at: broadcast.completedAt,
        total_users: broadcast.totalUsers,
        sent_count: broadcast.sentCount,
        failed_count: broadcast.failedCount,
        filters: broadcast.filters as any,
        created_at: broadcast.createdAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({ detail: error.errors });
      }
      console.error('Error creating broadcast:', error);
      return res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

/**
 * POST /api/broadcasts/:broadcastId/cancel
 * Отменить рассылку
 */
router.post('/:broadcastId/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const broadcastId = parseInt(req.params.broadcastId, 10);

    if (isNaN(broadcastId)) {
      return res.status(400).json({ detail: 'Invalid broadcast ID' });
    }

    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: broadcastId,
        ownerId: userId,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ detail: 'Broadcast not found' });
    }

    // Можно отменить только pending или scheduled рассылки
    if (!['pending', 'scheduled'].includes(broadcast.status)) {
      return res.status(400).json({
        detail: `Cannot cancel broadcast with status ${broadcast.status}`,
      });
    }

    // Удаляем медиа файл при отмене
    if (broadcast.mediaUrl) {
      deleteMediaFile(broadcast.mediaUrl);
    }
    if (broadcast.mediaFiles) {
      deleteMediaFilesList(broadcast.mediaFiles);
    }

    const updatedBroadcast = await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'cancelled',
        mediaUrl: null,
        mediaType: null,
        mediaFiles: Prisma.DbNull,
      },
    });

    return res.json({
      id: updatedBroadcast.id,
      bot_id: updatedBroadcast.botId,
      owner_id: updatedBroadcast.ownerId,
      message_text: updatedBroadcast.messageText,
      template_id: updatedBroadcast.templateId,
      media_type: updatedBroadcast.mediaType,
      media_url: updatedBroadcast.mediaUrl,
      media_files: updatedBroadcast.mediaFiles as any,
      status: updatedBroadcast.status,
      scheduled_at: updatedBroadcast.scheduledAt,
      started_at: updatedBroadcast.startedAt,
      completed_at: updatedBroadcast.completedAt,
      total_users: updatedBroadcast.totalUsers,
      sent_count: updatedBroadcast.sentCount,
      failed_count: updatedBroadcast.failedCount,
      filters: updatedBroadcast.filters as any,
      created_at: updatedBroadcast.createdAt,
    });
  } catch (error) {
    console.error('Error cancelling broadcast:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * DELETE /api/broadcasts/:broadcastId
 * Удалить рассылку и связанные медиа файлы
 * Query параметр: delete_messages=true для удаления сообщений из бота
 */
router.delete('/:broadcastId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const broadcastId = parseInt(req.params.broadcastId, 10);
    const debug = process.env.NODE_ENV !== 'production';
    
    // Пробуем получить параметр разными способами
    let deleteMessages = false;
    
    // Способ 1: через заголовок (ПРИОРИТЕТНЫЙ - наиболее надежный для DELETE)
    const headerValue = req.headers['x-delete-messages'] || req.headers['X-Delete-Messages'];
    if (headerValue === 'true' || headerValue === '1') {
      deleteMessages = true;
      if (debug) console.log(`[Delete Broadcast] Found delete_messages in header:`, headerValue);
    }
    
    // Способ 2: через req.body
    if (!deleteMessages && req.body && typeof req.body === 'object') {
      const bodyValue = req.body.delete_messages || req.body.deleteMessages;
      if (bodyValue === 'true' || bodyValue === '1') {
        deleteMessages = true;
        if (debug) console.log(`[Delete Broadcast] Found delete_messages in req.body:`, bodyValue);
      }
    }
    
    // Способ 3: через req.query (стандартный)
    if (!deleteMessages) {
      const queryParam = req.query.delete_messages || req.query['delete_messages'];
      if (queryParam === 'true' || queryParam === '1') {
        deleteMessages = true;
        if (debug) console.log(`[Delete Broadcast] Found delete_messages in req.query:`, queryParam);
      }
    }
    
    // Способ 4: парсим URL вручную из req.originalUrl или req.url
    if (!deleteMessages) {
      const urlToParse = req.originalUrl || req.url || '';
      const match = urlToParse.match(/[?&]delete_messages=([^&]*)/);
      if (match && match[1]) {
        const paramValue = decodeURIComponent(match[1]);
        if (paramValue === 'true' || paramValue === '1') {
          deleteMessages = true;
          if (debug) console.log(`[Delete Broadcast] Found delete_messages in URL:`, paramValue);
        }
      }
    }
    
    // Подробные логи только в dev
    if (debug) {
      console.log(`[Delete Broadcast] Request to delete broadcast ${broadcastId}`);
      console.log(`[Delete Broadcast] req.url:`, req.url);
      console.log(`[Delete Broadcast] req.originalUrl:`, req.originalUrl);
      console.log(`[Delete Broadcast] req.path:`, req.path);
      console.log(`[Delete Broadcast] Query params:`, req.query);
      console.log(`[Delete Broadcast] req.body:`, req.body);
      console.log(`[Delete Broadcast] Content-Type header:`, req.headers['content-type']);
      console.log(`[Delete Broadcast] X-Delete-Messages header:`, req.headers['x-delete-messages'] || req.headers['X-Delete-Messages']);
      console.log(`[Delete Broadcast] delete_messages final:`, deleteMessages);
    }

    if (isNaN(broadcastId)) {
      return res.status(400).json({ detail: 'Invalid broadcast ID' });
    }

    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: broadcastId,
        ownerId: userId,
      },
      include: {
        bot: true,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ detail: 'Broadcast not found' });
    }

    // Если нужно удалить сообщения из бота
    if (deleteMessages) {
      try {
        const logs = await prisma.broadcastLog.findMany({
          where: {
            broadcastId,
            success: true,
            messageId: { not: null },
          },
        });

        if (logs.length === 0) {
          const allLogs = await prisma.broadcastLog.findMany({
            where: { broadcastId },
          });
          if (allLogs.length > 0) {
            const logsWithMessageId = allLogs.filter(log => log.messageId !== null);
            if (logsWithMessageId.length === 0) {
              console.warn(`[Delete Broadcast] No message_id found in logs. This might mean messages were sent before message_id tracking was added.`);
            }
          }
        }

        if (logs.length > 0) {
          const { botManager } = await import('../services/botManager');
          const bot = botManager.getBot(broadcast.botId);
          const isRunning = botManager.isRunning(broadcast.botId);

          if (bot && isRunning) {
            let deletedCount = 0;
            let failedCount = 0;

            for (const log of logs) {
              try {
                if (log.messageId) {
                  const chatId = Number(log.telegramUserId);
                  const msgId = log.messageId;
                  await bot.api.deleteMessage(chatId, msgId);
                  deletedCount++;
                } else {
                  console.warn(`[Delete Broadcast] Log ${log.id} has null messageId, skipping`);
                }
              } catch (error: any) {
                failedCount++;
                const errorMsg = error.description || error.message || String(error);
                const errorCode = error.error_code || 'unknown';

                console.error(
                  `[Delete Broadcast] Error deleting message ${log.messageId} for user ${log.telegramUserId}:`,
                  { error: errorMsg, code: errorCode }
                );

                const isIgnorableError =
                  errorMsg.includes('message to delete not found') ||
                  errorMsg.includes('message can\'t be deleted') ||
                  errorMsg.includes('chat not found') ||
                  errorMsg.includes('message not found') ||
                  errorMsg.includes('Bad Request: message to delete not found') ||
                  errorCode === 400;

                if (!isIgnorableError) {
                  console.error(`[Delete Broadcast] Unexpected error:`, errorMsg, error.stack);
                }
              }
            }

            if (debug) {
              console.log(`[Delete Broadcast] Completed: ${deletedCount} deleted, ${failedCount} failed for broadcast ${broadcastId}`);
            }
          } else {
            console.warn(
              `[Delete Broadcast] Bot ${broadcast.botId} is not running or bot instance is null, cannot delete messages for broadcast ${broadcastId}`
            );
          }
        } else {
          console.warn(`[Delete Broadcast] No logs with message_id found for broadcast ${broadcastId}`);
        }
      } catch (error) {
        console.error(`[Delete Broadcast] Error deleting messages for broadcast ${broadcastId}:`, error);
        // Продолжаем удаление рассылки даже если не удалось удалить сообщения
      }
    }

    // Удаляем медиа файл, если он есть
    if (broadcast.mediaUrl) {
      deleteMediaFile(broadcast.mediaUrl);
    }
    if (broadcast.mediaFiles) {
      deleteMediaFilesList(broadcast.mediaFiles);
    }

    // Удаляем рассылку из БД (логи удалятся каскадно)
    await prisma.broadcast.delete({
      where: { id: broadcastId },
    });

    console.log(`Broadcast ${broadcastId} deleted by user ${userId}${deleteMessages ? ' with messages' : ''}`);

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting broadcast:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
