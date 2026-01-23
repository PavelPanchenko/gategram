/**
 * Очередь для отправки рассылок
 */

import { Queue, QueueEvents } from 'bullmq';
import { config } from '../core/config';
import type { RedisOptions } from 'ioredis';

function buildRedisConnection(): RedisOptions {
  // Приоритет: REDIS_URL из config
  if (config.redisUrl) {
    try {
      const u = new URL(config.redisUrl);
      const db = u.pathname?.startsWith('/') ? parseInt(u.pathname.slice(1) || '0', 10) : 0;
      return {
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : 6379,
        password: u.password || undefined,
        db: Number.isFinite(db) ? db : 0,
      };
    } catch {
      // fallback ниже
    }
  }

  // Fallback: REDIS_HOST/REDIS_PORT
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  };
}

// Настройка подключения к Redis
const connection: RedisOptions = buildRedisConnection();

// Создаем очередь для рассылок
export const broadcastQueue = new Queue('broadcasts', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Храним завершенные задачи 1 час
      count: 1000, // Максимум 1000 завершенных задач
    },
    removeOnFail: {
      age: 86400, // Храним неудачные задачи 24 часа
    },
  },
});

// Создаем очередь для проверки запланированных рассылок
export const scheduledBroadcastQueue = new Queue('scheduled-broadcasts', {
  connection,
  defaultJobOptions: {
    // repeat job добавляется при старте приложения (см. src/index.ts)
    // Этот блок оставляем пустым, чтобы случайно не сделать repeat по умолчанию для всех задач.
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
  },
});

// События очереди для мониторинга
export const broadcastQueueEvents = new QueueEvents('broadcasts', {
  connection,
});

export { connection };
