import { Router, Request, Response } from 'express';
import prisma from '../core/database';
import { createClient } from 'redis';
import { config } from '../core/config';

const router = Router();

// Простая проверка
router.get('/ping', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'pong' });
});

// Полная проверка здоровья
router.get('', async (req: Request, res: Response) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  // Проверка базы данных
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbStatus = `error: ${error instanceof Error ? error.message : 'unknown'}`;
  }

  // Проверка Redis
  let redisClient: ReturnType<typeof createClient> | null = null;
  try {
    redisClient = createClient({ url: config.redisUrl });
    await redisClient.connect();
    await redisClient.ping();
  } catch (error) {
    redisStatus = `error: ${error instanceof Error ? error.message : 'unknown'}`;
  } finally {
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (error) {
        // Игнорируем ошибки при закрытии
      }
    }
  }

  const overallStatus = dbStatus === 'ok' && redisStatus === 'ok' ? 'healthy' : 'unhealthy';

  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    database: dbStatus,
    redis: redisStatus,
    version: '1.0.0',
  });
});

export default router;
