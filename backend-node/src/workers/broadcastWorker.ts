/**
 * Worker для обработки рассылок
 */

import { Worker, Job } from 'bullmq';
import prisma from '../core/database';
import { botManager } from '../services/botManager';
import { filterUsersForBroadcast } from '../utils/broadcastFilters';
import { processTemplate } from '../utils/templateProcessor';
import { connection, broadcastQueue } from '../queues/broadcastQueue';
import path from 'path';
import fs from 'fs';
import { InputFile } from 'grammy';

// Получаем путь к медиа-директории
const getMediaDir = () => {
  if (process.env.MEDIA_DIR) {
    return process.env.MEDIA_DIR;
  }
  // По умолчанию храним медиа внутри backend-node
  const projectRoot = process.cwd();
  return path.join(projectRoot, 'media', 'broadcasts');
};

const MEDIA_DIR = getMediaDir();
const BATCH_SIZE = 30; // Размер батча для отправки
const RATE_LIMIT_DELAY = 1000; // Задержка между батчами (1 секунда)

// Создаем worker для обработки рассылок
export const broadcastWorker = new Worker(
  'broadcasts',
  async (job: Job) => {
    const broadcastId = job.data.broadcastId;

    // Получаем рассылку из БД
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: {
        bot: true,
      },
    });

    if (!broadcast) {
      console.error(`Broadcast ${broadcastId} not found`);
      return;
    }

    // Проверяем статус
    if (!['pending', 'scheduled'].includes(broadcast.status)) {
      return;
    }

    // Если рассылка запланирована, проверяем, что время наступило
    if (broadcast.status === 'scheduled' && broadcast.scheduledAt) {
      const now = new Date();
      const scheduledTime = new Date(broadcast.scheduledAt);
      if (scheduledTime > now) {
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
    if (!broadcast.bot) {
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'failed' },
      });
      throw new Error(`Bot ${broadcast.botId} not found`);
    }

    // Получаем список пользователей с применением фильтров
    const filters = (broadcast.filters as Record<string, any>) || {};
    const filteredUserIds = await filterUsersForBroadcast(broadcast.botId, filters);

    if (filteredUserIds.length === 0) {
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          totalUsers: 0,
        },
      });
      deleteAllBroadcastMedia(broadcast);
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
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'failed' },
      });
      throw new Error(`Bot ${broadcast.botId} is not running`);
    }

    // Отправляем сообщения батчами
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < filteredUserIds.length; i += BATCH_SIZE) {
      const batch = filteredUserIds.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map((userId) =>
        sendMessageToUser(
          botInstance,
          userId,
          broadcast,
          broadcast.bot.token
        ).catch((error) => {
          console.error(`Failed to send to user ${userId}:`, error);
          return false;
        })
      );

      const results = await Promise.all(batchPromises);
      sentCount += results.filter((r) => r === true).length;
      failedCount += results.filter((r) => r === false).length;

      // Обновляем счетчики в БД
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          sentCount,
          failedCount,
        },
      });

      // Rate limiting: ждем между батчами
      if (i + BATCH_SIZE < filteredUserIds.length) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    }

    // Завершаем рассылку
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        sentCount,
        failedCount,
      },
    });

    deleteAllBroadcastMedia(broadcast);
  },
  {
    connection,
    concurrency: 1, // Обрабатываем одну рассылку за раз
  }
);

function deleteAllBroadcastMedia(broadcast: any) {
  try {
    if (broadcast?.mediaUrl) {
      deleteMediaFile(broadcast.mediaUrl);
    }
    const mediaFiles = (broadcast?.mediaFiles as Array<{ type?: string; url?: string }>) || [];
    for (const item of mediaFiles) {
      if (item?.url) {
        deleteMediaFile(item.url);
      }
    }
  } catch (e) {
    console.warn('Failed to cleanup broadcast media files:', e);
  }
}

async function sendMessageToUser(
  botInstance: any,
  userId: number,
  broadcast: any,
  botToken: string
): Promise<boolean> {
  try {
    // Получаем пользователя из БД
    const user = await prisma.telegramUser.findUnique({
      where: { id: userId },
    });

    if (!user || user.status !== 'active') {
      return false;
    }

    // Обрабатываем шаблон, если используется
    let messageText = broadcast.messageText;
    if (broadcast.templateId) {
      const template = await prisma.messageTemplate.findUnique({
        where: { id: broadcast.templateId },
      });
      if (template) {
        messageText = processTemplate(template.content as string, user, {});
      }
    } else {
      messageText = processTemplate(messageText, user, {});
    }

    // Обновляем активность пользователя
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
        const mediaPath = findMediaFile(mediaItem.url);
        if (!mediaPath) {
          console.warn(`Media file not found: ${mediaItem.url}`);
          continue;
        }

        const mediaType = mediaItem.type;
        const caption = idx === 0 ? messageText : undefined;

        const file = new InputFile(mediaPath);
        if (mediaType === 'photo') {
          mediaGroup.push({
            type: 'photo',
            media: file,
            caption,
          });
        } else if (mediaType === 'video') {
          mediaGroup.push({
            type: 'video',
            media: file,
            caption,
          });
        } else if (mediaType === 'audio') {
          mediaGroup.push({
            type: 'audio',
            media: file,
            caption,
          });
        } else {
          mediaGroup.push({
            type: 'document',
            media: file,
            caption,
          });
        }
      }

      if (mediaGroup.length > 0) {
        if (mediaGroup.length === 1) {
          // Отправляем одиночный файл
          const item = mediaGroup[0];
          let result;
          if (item.type === 'photo') {
            result = await botInstance.api.sendPhoto(Number(user.telegramUserId), item.media, {
              caption: item.caption,
            });
          } else if (item.type === 'video') {
            result = await botInstance.api.sendVideo(Number(user.telegramUserId), item.media, {
              caption: item.caption,
            });
          } else if (item.type === 'audio') {
            result = await botInstance.api.sendAudio(Number(user.telegramUserId), item.media, {
              caption: item.caption,
            });
          } else {
            result = await botInstance.api.sendDocument(Number(user.telegramUserId), item.media, {
              caption: item.caption,
            });
          }
          messageId = result?.message_id || null;
        } else {
          // Отправляем медиа-группу (возвращает массив сообщений, берем первое)
          const results = await botInstance.api.sendMediaGroup(Number(user.telegramUserId), mediaGroup as any);
          messageId = results?.[0]?.message_id || null;
        }
      } else {
        // Если не удалось загрузить файлы, отправляем только текст
        const result = await botInstance.api.sendMessage(Number(user.telegramUserId), messageText);
        messageId = result?.message_id || null;
      }
    }
    // Отправляем одиночное медиа (для обратной совместимости)
    else if (broadcast.mediaType && broadcast.mediaUrl) {
      const mediaPath = findMediaFile(broadcast.mediaUrl);
      if (mediaPath) {
        const file = new InputFile(mediaPath);
        let result;
        if (broadcast.mediaType === 'photo') {
          result = await botInstance.api.sendPhoto(Number(user.telegramUserId), file, {
            caption: messageText,
          });
        } else if (broadcast.mediaType === 'video') {
          result = await botInstance.api.sendVideo(Number(user.telegramUserId), file, {
            caption: messageText,
          });
        } else if (broadcast.mediaType === 'document') {
          result = await botInstance.api.sendDocument(Number(user.telegramUserId), file, {
            caption: messageText,
          });
        } else if (broadcast.mediaType === 'audio') {
          result = await botInstance.api.sendAudio(Number(user.telegramUserId), file, {
            caption: messageText,
          });
        }
        messageId = result?.message_id || null;
      } else {
        // Файл не найден, отправляем только текст
        const result = await botInstance.api.sendMessage(Number(user.telegramUserId), messageText);
        messageId = result?.message_id || null;
      }
    } else {
      // Нет медиа, отправляем только текст
      const result = await botInstance.api.sendMessage(Number(user.telegramUserId), messageText);
      messageId = result?.message_id || null;
    }

    // Логируем успешную отправку
    await prisma.broadcastLog.create({
      data: {
        broadcastId: broadcast.id,
        telegramUserId: user.telegramUserId,
        messageId,
        success: true,
      },
    });

    if (!messageId) {
      console.warn(`[Broadcast Worker] message_id is null for user ${user.telegramUserId} in broadcast ${broadcast.id}`);
    }

    return true;
  } catch (error: any) {
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
      if (error.description?.includes('blocked') || error.message?.includes('blocked')) {
        await prisma.telegramUser.update({
          where: { id: userId },
          data: { status: 'blocked' },
        });
      }
    }

    return false;
  }
}

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

function deleteMediaFile(mediaUrl: string): boolean {
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

  return false;
}

// Worker для проверки запланированных рассылок
export const scheduledBroadcastWorker = new Worker(
  'scheduled-broadcasts',
  async (job: Job) => {
    const now = new Date();

    // Находим все запланированные рассылки, время которых наступило
    const scheduledBroadcasts = await prisma.broadcast.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          lte: now,
        },
      },
    });

    for (const broadcast of scheduledBroadcasts) {
      try {
        // Делаем операцию идемпотентной:
        // 1) переводим scheduled -> pending (только если всё ещё scheduled)
        // 2) добавляем job с уникальным jobId, чтобы избежать дублей
        const updated = await prisma.broadcast.updateMany({
          where: { id: broadcast.id, status: 'scheduled' },
          data: { status: 'pending' },
        });
        if (updated.count === 0) {
          continue;
        }

        await broadcastQueue.add(
          'send-broadcast',
          { broadcastId: broadcast.id },
          { jobId: `broadcast-${broadcast.id}` }
        );
      } catch (error) {
        console.error(`Error starting scheduled broadcast ${broadcast.id}:`, error);
        await prisma.broadcast.update({
          where: { id: broadcast.id },
          data: { status: 'failed' },
        });
      }
    }
  },
  {
    connection,
  }
);
