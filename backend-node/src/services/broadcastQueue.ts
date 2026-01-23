/**
 * Система очередей для асинхронной отправки рассылок
 */

import { Queue, Worker, Job } from 'bullmq';
import { InputFile } from 'grammy';
import { config } from '../core/config';
import prisma from '../core/database';
import { botManager } from './botManager';
import { filterUsersForBroadcast } from '../utils/broadcastFilters';
import { processTemplate } from '../utils/templateProcessor';
import fs from 'fs';
import path from 'path';

// Создаем очередь для рассылок
export const broadcastQueue = new Queue('broadcasts', {
  connection: {
    host: config.redisHost || 'localhost',
    port: config.redisPort || 6379,
  },
});

// Константы для rate limiting
const BROADCAST_RATE_LIMIT = 30; // сообщений в секунду (лимит Telegram)
const BATCH_SIZE = 30; // размер батча для отправки

// Папка для медиа файлов
const MEDIA_DIR = process.env.MEDIA_DIR || '/app/media/broadcasts';

/**
 * Worker для обработки задач рассылок
 */
export const broadcastWorker = new Worker(
  'broadcasts',
  async (job: Job) => {
    const broadcastId = job.data.broadcastId as number;

    console.log(`Processing broadcast ${broadcastId}`);

    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      console.error(`Broadcast ${broadcastId} not found`);
      return;
    }

    // Проверяем статус
    if (!['pending', 'scheduled'].includes(broadcast.status)) {
      console.warn(`Broadcast ${broadcastId} has status ${broadcast.status}, skipping`);
      return;
    }

    // Если рассылка запланирована, проверяем, что время наступило
    if (broadcast.status === 'scheduled' && broadcast.scheduledAt) {
      const now = new Date();
      const scheduledTime = new Date(broadcast.scheduledAt);
      if (scheduledTime > now) {
        console.log(
          `Broadcast ${broadcastId} is scheduled for ${scheduledTime}, current time is ${now}, skipping`
        );
        return;
      }
    }

    // Обновляем статус на "отправка"
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'sending',
        startedAt: new Date(),
      },
    });

    // Получаем бота
    const botData = await prisma.bot.findUnique({
      where: { id: broadcast.botId },
    });

    if (!botData) {
      console.error(`Bot ${broadcast.botId} not found`);
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'failed' },
      });
      return;
    }

    // Получаем список пользователей с применением фильтров
    const filters = (broadcast.filters as Record<string, any>) || {};
    const filteredUserIds = await filterUsersForBroadcast(broadcast.botId, filters);

    if (filteredUserIds.length === 0) {
      console.warn(`No active users for bot ${broadcast.botId}`);
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          totalUsers: 0,
        },
      });
      return;
    }

    // Обновляем total_users
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { totalUsers: filteredUserIds.length },
    });

    // Получаем экземпляр бота
    const botInstance = botManager.getBot(broadcast.botId);
    if (!botInstance) {
      console.error(`Bot ${broadcast.botId} is not running`);
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'failed' },
      });
      return;
    }

    // Отправляем сообщения батчами
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < filteredUserIds.length; i += BATCH_SIZE) {
      const batch = filteredUserIds.slice(i, i + BATCH_SIZE);

      // Отправляем батч
      const results = await Promise.allSettled(
        batch.map((userId) => sendMessageToUser(botInstance, broadcast, userId))
      );

      // Обрабатываем результаты
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled' && result.value) {
          sentCount++;
        } else {
          failedCount++;
          console.error(
            `Failed to send to user ${batch[j]}:`,
            result.status === 'rejected' ? result.reason : 'Unknown error'
          );
        }
      }

      // Обновляем счетчики в БД
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          sentCount,
          failedCount,
        },
      });

      // Rate limiting: ждем 1 секунду между батчами
      if (i + BATCH_SIZE < filteredUserIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Завершаем рассылку
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    // Удаляем медиа файл после завершения рассылки
    if (broadcast.mediaUrl) {
      deleteMediaFile(broadcast.mediaUrl);
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          mediaUrl: null,
          mediaType: null,
        },
      });
    }

    console.log(`Broadcast ${broadcastId} completed: ${sentCount} sent, ${failedCount} failed`);
  },
  {
    connection: {
      host: config.redisHost || 'localhost',
      port: config.redisPort || 6379,
    },
    concurrency: 1, // Обрабатываем одну рассылку за раз
  }
);

/**
 * Отправляет сообщение одному пользователю
 */
async function sendMessageToUser(
  bot: any,
  broadcast: any,
  userId: number
): Promise<boolean> {
  try {
    // Получаем пользователя из БД
    const user = await prisma.telegramUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    // Обрабатываем переменные в сообщении
    let finalMessageText = broadcast.messageText;

    // Если используется шаблон, используем его содержимое
    if (broadcast.templateId) {
      const template = await prisma.messageTemplate.findUnique({
        where: { id: broadcast.templateId },
      });
      if (template) {
        finalMessageText = processTemplate(template.content, user, {});
      }
    } else {
      // Обрабатываем переменные в message_text
      finalMessageText = processTemplate(broadcast.messageText, user, {});
    }

    // Обновляем last_activity пользователя
    await prisma.telegramUser.update({
      where: { id: userId },
      data: { lastActivity: new Date() },
    });

    // Отправляем медиа-группу, если есть несколько файлов
    const mediaFiles = (broadcast.mediaFiles as Array<{ type: string; url: string }>) || [];
    let messageId: number | null = null;
    
    if (mediaFiles.length > 0) {
      const mediaGroup = [];
      for (let idx = 0; idx < Math.min(mediaFiles.length, 10); idx++) {
        const mediaItem = mediaFiles[idx];
        const mediaType = mediaItem.type;
        const mediaUrl = mediaItem.url;

        if (!mediaUrl) continue;

        // Находим файл
        const mediaPath = findMediaFile(mediaUrl);
        if (!mediaPath || !fs.existsSync(mediaPath)) {
          console.warn(`Media file not found: ${mediaUrl}, skipping`);
          continue;
        }

        const caption = idx === 0 ? finalMessageText : undefined;
        const inputFile = new InputFile(mediaPath);

        if (mediaType === 'photo') {
          mediaGroup.push({
            type: 'photo',
            media: inputFile,
            caption,
          });
        } else if (mediaType === 'video') {
          mediaGroup.push({
            type: 'video',
            media: inputFile,
            caption,
          });
        } else if (mediaType === 'audio') {
          mediaGroup.push({
            type: 'audio',
            media: inputFile,
            caption,
          });
        } else {
          mediaGroup.push({
            type: 'document',
            media: inputFile,
            caption,
          });
        }
      }

      if (mediaGroup.length > 0) {
        if (mediaGroup.length === 1) {
          // Если один файл, отправляем обычным способом
          const mediaItem = mediaGroup[0];
          let result;
          if (mediaItem.type === 'photo') {
            result = await bot.api.sendPhoto(Number(user.telegramUserId), mediaItem.media as InputFile, {
              caption: mediaItem.caption,
            });
          } else if (mediaItem.type === 'video') {
            result = await bot.api.sendVideo(Number(user.telegramUserId), mediaItem.media as InputFile, {
              caption: mediaItem.caption,
            });
          } else if (mediaItem.type === 'audio') {
            result = await bot.api.sendAudio(Number(user.telegramUserId), mediaItem.media as InputFile, {
              caption: mediaItem.caption,
            });
          } else {
            result = await bot.api.sendDocument(Number(user.telegramUserId), mediaItem.media as InputFile, {
              caption: mediaItem.caption,
            });
          }
          messageId = result?.message_id || null;
        } else {
          // Отправляем медиа-группу (возвращает массив сообщений, берем первое)
          const results = await bot.api.sendMediaGroup(Number(user.telegramUserId), mediaGroup as any);
          messageId = results?.[0]?.message_id || null;
        }
      } else {
        // Если не удалось загрузить файлы, отправляем только текст
        const result = await bot.api.sendMessage(Number(user.telegramUserId), finalMessageText);
        messageId = result?.message_id || null;
      }
    }
    // Отправляем одиночное медиа (для обратной совместимости)
    else if (broadcast.mediaType && broadcast.mediaUrl) {
      const mediaPath = findMediaFile(broadcast.mediaUrl);
      
      if (mediaPath && fs.existsSync(mediaPath)) {
        let result;
        if (broadcast.mediaType === 'photo') {
          result = await bot.api.sendPhoto(Number(user.telegramUserId), { source: mediaPath }, {
            caption: finalMessageText,
          });
        } else if (broadcast.mediaType === 'video') {
          result = await bot.api.sendVideo(Number(user.telegramUserId), { source: mediaPath }, {
            caption: finalMessageText,
          });
        } else if (broadcast.mediaType === 'document') {
          result = await bot.api.sendDocument(Number(user.telegramUserId), { source: mediaPath }, {
            caption: finalMessageText,
          });
        } else if (broadcast.mediaType === 'audio') {
          result = await bot.api.sendAudio(Number(user.telegramUserId), { source: mediaPath }, {
            caption: finalMessageText,
          });
        }
        messageId = result?.message_id || null;
      } else {
        // Файл не найден, отправляем только текст
        const result = await bot.api.sendMessage(Number(user.telegramUserId), finalMessageText);
        messageId = result?.message_id || null;
      }
    } else {
      // Нет медиа, отправляем только текст
      const result = await bot.api.sendMessage(Number(user.telegramUserId), finalMessageText);
      messageId = result?.message_id || null;
    }

    // Логируем успешную отправку
    await prisma.broadcastLog.create({
      data: {
        broadcastId,
        telegramUserId: user.telegramUserId,
        messageId,
        success: true,
      },
    });
    
    if (messageId) {
      console.log(`[Broadcast] Saved message_id ${messageId} for user ${user.telegramUserId} in broadcast ${broadcastId}`);
    } else {
      console.warn(`[Broadcast] Warning: message_id is null for user ${user.telegramUserId} in broadcast ${broadcastId}`);
    }

    return true;
  } catch (error: any) {
    console.error(`Error sending to user ${userId}:`, error);

    // Логируем ошибку
    const user = await prisma.telegramUser.findUnique({
      where: { id: userId },
    });

    if (user) {
      await prisma.broadcastLog.create({
        data: {
          broadcastId: broadcast.id,
          telegramUserId: user.telegramUserId,
          success: false,
          errorMessage: error.message || String(error),
        },
      });

      // Если пользователь заблокировал бота, обновляем статус
      if (error.description?.includes('blocked') || error.description?.includes('forbidden')) {
        await prisma.telegramUser.update({
          where: { id: userId },
          data: { status: 'blocked' },
        });
      }
    }

    return false;
  }
}

/**
 * Находит медиа файл по пути
 */
function findMediaFile(mediaUrl: string): string | null {
  const possiblePaths = [
    mediaUrl,
    path.resolve(mediaUrl),
    path.join(MEDIA_DIR, path.basename(mediaUrl)),
  ];

  if (!path.isAbsolute(mediaUrl)) {
    possiblePaths.push(path.join(MEDIA_DIR, mediaUrl));
  }

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }

  return null;
}

/**
 * Удаляет медиа файл
 */
function deleteMediaFile(mediaUrl: string): boolean {
  const mediaPath = findMediaFile(mediaUrl);
  if (mediaPath && fs.existsSync(mediaPath)) {
    try {
      fs.unlinkSync(mediaPath);
      console.log(`Deleted media file: ${mediaPath}`);
      return true;
    } catch (error) {
      console.error(`Error deleting media file ${mediaPath}:`, error);
    }
  }
  return false;
}

/**
 * Проверяет запланированные рассылки и запускает те, время которых наступило
 */
export async function checkScheduledBroadcasts(): Promise<void> {
  const now = new Date();

  const scheduledBroadcasts = await prisma.broadcast.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: {
        lte: now,
      },
    },
  });

  console.log(`Found ${scheduledBroadcasts.length} scheduled broadcasts ready to send`);

  for (const broadcast of scheduledBroadcasts) {
    try {
      console.log(
        `Starting scheduled broadcast ${broadcast.id} (scheduled for ${broadcast.scheduledAt})`
      );
      await broadcastQueue.add('send-broadcast', { broadcastId: broadcast.id });
    } catch (error) {
      console.error(`Error starting scheduled broadcast ${broadcast.id}:`, error);
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { status: 'failed' },
      });
    }
  }
}

// Запускаем проверку запланированных рассылок каждую минуту
setInterval(() => {
  checkScheduledBroadcasts().catch((error) => {
    console.error('Error checking scheduled broadcasts:', error);
  });
}, 60000);
