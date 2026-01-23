import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';

const router = express.Router({ mergeParams: true });

// Схемы валидации
const MessageTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1),
  variables: z.record(z.string()).default({}),
  is_active: z.boolean().default(true),
});

const MessageTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  variables: z.record(z.string()).optional(),
  is_active: z.boolean().optional(),
});

/**
 * GET /api/bots/:botId/templates
 * Получить все шаблоны сообщений для бота
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

    const templates = await prisma.messageTemplate.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
    });

    const result = templates.map((template) => ({
      id: template.id,
      bot_id: template.botId,
      name: template.name,
      content: template.content,
      variables: template.variables as any,
      is_active: template.isActive,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
    }));

    return res.json(result);
  } catch (error) {
    console.error('Error getting templates:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/bots/:botId/templates/:templateId
 * Получить шаблон по ID
 */
router.get('/:templateId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(botId) || isNaN(templateId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or template ID' });
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

    const template = await prisma.messageTemplate.findFirst({
      where: {
        id: templateId,
        botId,
      },
    });

    if (!template) {
      return res.status(404).json({ detail: 'Template not found' });
    }

    return res.json({
      id: template.id,
      bot_id: template.botId,
      name: template.name,
      content: template.content,
      variables: template.variables as any,
      is_active: template.isActive,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
    });
  } catch (error) {
    console.error('Error getting template:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/bots/:botId/templates
 * Создать новый шаблон
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);

    if (isNaN(botId)) {
      return res.status(400).json({ detail: 'Invalid bot ID' });
    }

    const body = MessageTemplateCreateSchema.parse(req.body);

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

    const newTemplate = await prisma.messageTemplate.create({
      data: {
        botId,
        name: body.name,
        content: body.content,
        variables: body.variables || {},
        isActive: body.is_active,
      },
    });

    return res.status(201).json({
      id: newTemplate.id,
      bot_id: newTemplate.botId,
      name: newTemplate.name,
      content: newTemplate.content,
      variables: newTemplate.variables as any,
      is_active: newTemplate.isActive,
      created_at: newTemplate.createdAt,
      updated_at: newTemplate.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error creating template:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * PUT /api/bots/:botId/templates/:templateId
 * Обновить шаблон
 */
router.put('/:templateId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(botId) || isNaN(templateId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or template ID' });
    }

    const body = MessageTemplateUpdateSchema.parse(req.body);

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

    const template = await prisma.messageTemplate.findFirst({
      where: {
        id: templateId,
        botId,
      },
    });

    if (!template) {
      return res.status(404).json({ detail: 'Template not found' });
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.variables !== undefined) updateData.variables = body.variables;
    if (body.is_active !== undefined) updateData.isActive = body.is_active;

    const updatedTemplate = await prisma.messageTemplate.update({
      where: { id: templateId },
      data: updateData,
    });

    return res.json({
      id: updatedTemplate.id,
      bot_id: updatedTemplate.botId,
      name: updatedTemplate.name,
      content: updatedTemplate.content,
      variables: updatedTemplate.variables as any,
      is_active: updatedTemplate.isActive,
      created_at: updatedTemplate.createdAt,
      updated_at: updatedTemplate.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error updating template:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * DELETE /api/bots/:botId/templates/:templateId
 * Удалить шаблон
 */
router.delete('/:templateId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(botId) || isNaN(templateId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or template ID' });
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

    const template = await prisma.messageTemplate.findFirst({
      where: {
        id: templateId,
        botId,
      },
    });

    if (!template) {
      return res.status(404).json({ detail: 'Template not found' });
    }

    await prisma.messageTemplate.delete({
      where: { id: templateId },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting template:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
