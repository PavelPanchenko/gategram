import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import prisma from '../core/database';

const router = express.Router({ mergeParams: true });

// Схемы валидации
const UserTagCreateSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().default('#3B82F6'),
  description: z.string().max(200).optional(),
});

const UserTagUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().optional(),
  description: z.string().max(200).optional(),
});

const AssignTagsRequestSchema = z.object({
  tag_ids: z.array(z.number().int()),
});

/**
 * GET /api/bots/:botId/tags
 * Получить все теги для бота
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

    const tags = await prisma.userTag.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
    });

    const result = tags.map((tag) => ({
      id: tag.id,
      bot_id: tag.botId,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      created_at: tag.createdAt,
    }));

    return res.json(result);
  } catch (error) {
    console.error('Error getting tags:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/bots/:botId/tags
 * Создать новый тег
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);

    if (isNaN(botId)) {
      return res.status(400).json({ detail: 'Invalid bot ID' });
    }

    const body = UserTagCreateSchema.parse(req.body);

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

    // Проверяем, нет ли тега с таким именем
    const existingTag = await prisma.userTag.findFirst({
      where: {
        botId,
        name: body.name,
      },
    });

    if (existingTag) {
      return res.status(400).json({
        detail: 'Tag with this name already exists',
      });
    }

    const newTag = await prisma.userTag.create({
      data: {
        botId,
        name: body.name,
        color: body.color,
        description: body.description || null,
      },
    });

    return res.status(201).json({
      id: newTag.id,
      bot_id: newTag.botId,
      name: newTag.name,
      color: newTag.color,
      description: newTag.description,
      created_at: newTag.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error creating tag:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * PUT /api/bots/:botId/tags/:tagId
 * Обновить тег
 */
router.put('/:tagId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const tagId = parseInt(req.params.tagId, 10);

    if (isNaN(botId) || isNaN(tagId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or tag ID' });
    }

    const body = UserTagUpdateSchema.parse(req.body);

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

    const tag = await prisma.userTag.findFirst({
      where: {
        id: tagId,
        botId,
      },
    });

    if (!tag) {
      return res.status(404).json({ detail: 'Tag not found' });
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.description !== undefined) updateData.description = body.description;

    const updatedTag = await prisma.userTag.update({
      where: { id: tagId },
      data: updateData,
    });

    return res.json({
      id: updatedTag.id,
      bot_id: updatedTag.botId,
      name: updatedTag.name,
      color: updatedTag.color,
      description: updatedTag.description,
      created_at: updatedTag.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error updating tag:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * DELETE /api/bots/:botId/tags/:tagId
 * Удалить тег
 */
router.delete('/:tagId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const tagId = parseInt(req.params.tagId, 10);

    if (isNaN(botId) || isNaN(tagId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or tag ID' });
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

    const tag = await prisma.userTag.findFirst({
      where: {
        id: tagId,
        botId,
      },
    });

    if (!tag) {
      return res.status(404).json({ detail: 'Tag not found' });
    }

    await prisma.userTag.delete({
      where: { id: tagId },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting tag:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/bots/:botId/tags/:tagId/assign
 * Назначить тег пользователям
 */
router.post('/:tagId/assign', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const tagId = parseInt(req.params.tagId, 10);

    if (isNaN(botId) || isNaN(tagId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or tag ID' });
    }

    const body = AssignTagsRequestSchema.parse(req.body);

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

    const tag = await prisma.userTag.findFirst({
      where: {
        id: tagId,
        botId,
      },
    });

    if (!tag) {
      return res.status(404).json({ detail: 'Tag not found' });
    }

    // Получаем пользователей
    // Здесь это user_ids (список пользователей для назначения тега)
    const users = await prisma.telegramUser.findMany({
      where: {
        botId,
        id: { in: body.tag_ids },
      },
      include: {
        tags: true,
      },
    });

    // Назначаем тег пользователям
    for (const user of users) {
      const hasTag = user.tags.some((t) => t.id === tagId);
      if (!hasTag) {
        await prisma.telegramUser.update({
          where: { id: user.id },
          data: {
            tags: {
              connect: { id: tagId },
            },
          },
        });
      }
    }

    return res.json({
      message: `Tag assigned to ${users.length} users`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error assigning tag:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/bots/:botId/tags/users/:userId/assign
 * Назначить теги пользователю
 */
router.post('/users/:userId/assign', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const telegramUserId = parseInt(req.params.userId, 10);

    if (isNaN(botId) || isNaN(telegramUserId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or user ID' });
    }

    const body = AssignTagsRequestSchema.parse(req.body);

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

    const user = await prisma.telegramUser.findFirst({
      where: {
        id: telegramUserId,
        botId,
      },
    });

    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Проверяем, что все теги принадлежат этому боту
    const tags = await prisma.userTag.findMany({
      where: {
        botId,
        id: { in: body.tag_ids },
      },
    });

    if (tags.length !== body.tag_ids.length) {
      return res.status(400).json({
        detail: 'Some tags not found or do not belong to this bot',
      });
    }

    // Назначаем теги пользователю
    await prisma.telegramUser.update({
      where: { id: telegramUserId },
      data: {
        tags: {
          set: tags.map((tag) => ({ id: tag.id })),
        },
      },
    });

    return res.json({
      message: `Assigned ${tags.length} tags to user`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error assigning tags to user:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
