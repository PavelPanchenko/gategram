import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';

const router = express.Router({ mergeParams: true });

// Схемы валидации
const TriggerActionItemSchema = z.object({
  type: z.string(),
  data: z.record(z.any()).default({}),
});

const TriggerCreateSchema = z.object({
  name: z.string().min(1).max(100),
  event_type: z.string(),
  conditions: z.record(z.any()).default({}),
  actions: z.array(TriggerActionItemSchema).default([]),
  is_active: z.boolean().default(true),
  // Старые поля (deprecated)
  action_type: z.string().optional(),
  action_data: z.record(z.any()).optional(),
});

const TriggerUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  event_type: z.string().optional(),
  conditions: z.record(z.any()).optional(),
  actions: z.array(TriggerActionItemSchema).optional(),
  is_active: z.boolean().optional(),
  // Старые поля (deprecated)
  action_type: z.string().optional(),
  action_data: z.record(z.any()).optional(),
});

/**
 * GET /api/bots/:botId/triggers
 * Получить все триггеры для бота
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
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

    const triggers = await prisma.trigger.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
    });

    // Преобразуем в формат ответа
    const result = triggers.map((trigger) => ({
      id: trigger.id,
      bot_id: trigger.botId,
      name: trigger.name,
      event_type: trigger.eventType,
      conditions: trigger.conditions as any,
      actions: trigger.actions as any[],
      is_active: trigger.isActive,
      created_at: trigger.createdAt,
      updated_at: trigger.updatedAt,
      // Старые поля для обратной совместимости
      action_type: (trigger.actionType as string) || null,
      action_data: (trigger.actionData as any) || null,
    }));

    return res.json(result);
  } catch (error) {
    console.error('Error getting triggers:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/bots/:botId/triggers/:triggerId
 * Получить триггер по ID
 */
router.get('/:triggerId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const triggerId = parseInt(req.params.triggerId, 10);

    if (isNaN(botId) || isNaN(triggerId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or trigger ID' });
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

    const trigger = await prisma.trigger.findFirst({
      where: {
        id: triggerId,
        botId,
      },
    });

    if (!trigger) {
      return res.status(404).json({ detail: 'Trigger not found' });
    }

    return res.json({
      id: trigger.id,
      bot_id: trigger.botId,
      name: trigger.name,
      event_type: trigger.eventType,
      conditions: trigger.conditions as any,
      actions: trigger.actions as any[],
      is_active: trigger.isActive,
      created_at: trigger.createdAt,
      updated_at: trigger.updatedAt,
      // Старые поля для обратной совместимости
      action_type: (trigger.actionType as string) || null,
      action_data: (trigger.actionData as any) || null,
    });
  } catch (error) {
    console.error('Error getting trigger:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/bots/:botId/triggers
 * Создать новый триггер
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);

    if (isNaN(botId)) {
      return res.status(400).json({ detail: 'Invalid bot ID' });
    }

    const body = TriggerCreateSchema.parse(req.body);

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

    // Подготавливаем данные для создания
    const createData: any = {
      botId,
      name: body.name,
      eventType: body.event_type,
      conditions: body.conditions || {},
      actions: body.actions || [],
      isActive: body.is_active,
    };

    // Обрабатываем старые поля для обратной совместимости
    if (body.action_type && body.action_data) {
      // Если есть старые поля, но нет actions, создаем action из них
      if (!body.actions || body.actions.length === 0) {
        createData.actions = [
          {
            type: body.action_type,
            data: body.action_data,
          },
        ];
      }
      createData.actionType = body.action_type;
      createData.actionData = body.action_data;
    }

    const newTrigger = await prisma.trigger.create({
      data: createData,
    });

    return res.status(201).json({
      id: newTrigger.id,
      bot_id: newTrigger.botId,
      name: newTrigger.name,
      event_type: newTrigger.eventType,
      conditions: newTrigger.conditions as any,
      actions: newTrigger.actions as any[],
      is_active: newTrigger.isActive,
      created_at: newTrigger.createdAt,
      updated_at: newTrigger.updatedAt,
      action_type: (newTrigger.actionType as string) || null,
      action_data: (newTrigger.actionData as any) || null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error creating trigger:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * PUT /api/bots/:botId/triggers/:triggerId
 * Обновить триггер
 */
router.put('/:triggerId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const triggerId = parseInt(req.params.triggerId, 10);

    if (isNaN(botId) || isNaN(triggerId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or trigger ID' });
    }

    const body = TriggerUpdateSchema.parse(req.body);

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

    const trigger = await prisma.trigger.findFirst({
      where: {
        id: triggerId,
        botId,
      },
    });

    if (!trigger) {
      return res.status(404).json({ detail: 'Trigger not found' });
    }

    // Подготавливаем данные для обновления
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.event_type !== undefined) updateData.eventType = body.event_type;
    if (body.conditions !== undefined) updateData.conditions = body.conditions;
    if (body.actions !== undefined) updateData.actions = body.actions;
    if (body.is_active !== undefined) updateData.isActive = body.is_active;

    // Обрабатываем старые поля для обратной совместимости
    if (body.action_type !== undefined) updateData.actionType = body.action_type;
    if (body.action_data !== undefined) updateData.actionData = body.action_data;

    // Если есть старые поля, но нет actions, создаем action из них
    if (body.action_type && body.action_data && (!body.actions || body.actions.length === 0)) {
      updateData.actions = [
        {
          type: body.action_type,
          data: body.action_data,
        },
      ];
    }

    const updatedTrigger = await prisma.trigger.update({
      where: { id: triggerId },
      data: updateData,
    });

    return res.json({
      id: updatedTrigger.id,
      bot_id: updatedTrigger.botId,
      name: updatedTrigger.name,
      event_type: updatedTrigger.eventType,
      conditions: updatedTrigger.conditions as any,
      actions: updatedTrigger.actions as any[],
      is_active: updatedTrigger.isActive,
      created_at: updatedTrigger.createdAt,
      updated_at: updatedTrigger.updatedAt,
      action_type: (updatedTrigger.actionType as string) || null,
      action_data: (updatedTrigger.actionData as any) || null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error updating trigger:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * DELETE /api/bots/:botId/triggers/:triggerId
 * Удалить триггер
 */
router.delete('/:triggerId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const triggerId = parseInt(req.params.triggerId, 10);

    if (isNaN(botId) || isNaN(triggerId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or trigger ID' });
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

    const trigger = await prisma.trigger.findFirst({
      where: {
        id: triggerId,
        botId,
      },
    });

    if (!trigger) {
      return res.status(404).json({ detail: 'Trigger not found' });
    }

    await prisma.trigger.delete({
      where: { id: triggerId },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting trigger:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
