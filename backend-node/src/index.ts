import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import { config } from './core/config';
import { errorHandler } from './middleware/errorHandler';
import prisma from './core/database';
import { botManager } from './services/botManager';
import { scheduledBroadcastQueue } from './queues/broadcastQueue';
import authRouter from './api/auth';
import healthRouter from './api/health';
import botsRouter from './api/bots';
import triggersRouter from './api/triggers';
import messageTemplatesRouter from './api/messageTemplates';
import userTagsRouter from './api/userTags';
import broadcastsRouter from './api/broadcasts';
import analyticsRouter from './api/analytics';
import globalTagsRouter from './api/globalTags';
import globalTriggersRouter from './api/globalTriggers';
import globalUsersRouter from './api/globalUsers';
import globalTemplatesRouter from './api/globalTemplates';
import referralLinksRouter from './api/referralLinks';

const app = express();

// Middleware
// CORS настройки - разрешаем запросы с фронтенда
app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, Postman, curl)
    if (!origin) return callback(null, true);
    
    // Проверяем, есть ли origin в списке разрешенных
    if (config.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // В dev режиме логируем для отладки
      if (process.env.NODE_ENV !== 'production') {
        console.log(`⚠️  CORS: Blocked origin: ${origin}`);
        console.log(`   Allowed origins: ${config.corsOrigins.join(', ')}`);
      }
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Delete-Messages'],
  exposedHeaders: ['*'],
  // Кэшируем preflight в браузере, чтобы уменьшить задержки на cross-origin POST/PUT/DELETE
  maxAge: 86400,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'GateGram API (Node.js)', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.use('/api/auth', authRouter);
app.use('/api/health', healthRouter);
// Подключаем referralLinksRouter ПЕРЕД botsRouter, чтобы более специфичные роуты обрабатывались первыми
app.use('/api/bots', referralLinksRouter);
app.use('/api/bots', botsRouter);
app.use('/api/bots/:botId/triggers', triggersRouter);
app.use('/api/bots/:botId/templates', messageTemplatesRouter);
app.use('/api/bots/:botId/tags', userTagsRouter);
app.use('/api/broadcasts', broadcastsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/tags', globalTagsRouter);
app.use('/api/triggers', globalTriggersRouter);
app.use('/api/users', globalUsersRouter);
app.use('/api/templates', globalTemplatesRouter);

// Error handler (должен быть последним)
app.use(errorHandler);

// Запуск сервера
const PORT = config.port;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 GateGram Node.js Backend running on port ${PORT}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  console.log(`🌐 CORS origins: ${config.corsOrigins.join(', ')}`);

  // Прогреваем подключение Prisma, чтобы первый запрос (например /auth/login) не ловил cold-start
  try {
    await prisma.$connect();
  } catch (e) {
    console.error('❌ Prisma connect failed during startup:', e);
  }

  // Запускаем периодическую проверку запланированных рассылок (BullMQ repeatable job)
  try {
    const repeatJobs = await scheduledBroadcastQueue.getRepeatableJobs();
    const jobId = 'check-scheduled-broadcasts';
    const alreadyExists = repeatJobs.some((j) => j.id === jobId);

    if (!alreadyExists) {
      await scheduledBroadcastQueue.add(
        'check-scheduled-broadcasts',
        {},
        {
          jobId,
          repeat: { pattern: '*/1 * * * *' }, // каждую минуту
          removeOnComplete: { age: 3600, count: 1000 },
        }
      );
      console.log('✅ Scheduled broadcasts checker enabled (every minute)');
    } else {
      console.log('✅ Scheduled broadcasts checker already enabled');
    }
  } catch (error) {
    console.error('❌ Failed to enable scheduled broadcasts checker:', error);
  }

  // Загружаем и запускаем активных ботов при старте
  try {
    console.log('=== LIFESPAN STARTUP ===');
    const activeBots = await prisma.bot.findMany({
      where: { isActive: true },
    });
    console.log(`Found ${activeBots.length} active bots to start`);

        for (const bot of activeBots) {
          console.log(`Starting bot ${bot.id} (token: ${bot.token.slice(0, 10)}...)`);
          const success = await botManager.startBot(bot.id, bot.token);
          if (success) {
            // Обновляем статус в БД, если бот успешно запущен
            await prisma.bot.update({
              where: { id: bot.id },
              data: { isActive: true },
            });
            console.log(`Bot ${bot.id} started successfully`);
          } else {
            // Если не удалось запустить, обновляем статус на неактивный
            await prisma.bot.update({
              where: { id: bot.id },
              data: { isActive: false },
            });
            console.error(`Failed to start bot ${bot.id}`);
          }
        }
    console.log('=== LIFESPAN STARTUP COMPLETE ===');
  } catch (error) {
    console.error(`Error starting bots: ${error}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('=== LIFESPAN SHUTDOWN ===');
  await botManager.stopAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('=== LIFESPAN SHUTDOWN ===');
  await botManager.stopAll();
  process.exit(0);
});
