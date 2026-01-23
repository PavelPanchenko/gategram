/**
 * API эндпоинты для управления реферальными ссылками
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../core/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Схемы валидации
const ReferralLinkCreateSchema = z.object({
  source: z.string().min(1).max(100),
});

const ReferralLinkUpdateSchema = z.object({
  source: z.string().min(1).max(100),
});

// GET /api/bots/:botId/referral-links - Получить все реферальные ссылки бота
router.get('/:botId/referral-links', authenticateToken, async (req: Request, res: Response) => {
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

    // Получаем реферальные ссылки
    const referralLinks = await prisma.referralLink.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
    });

    // Генерируем полные ссылки
    const linksWithUrls = referralLinks.map((link) => {
      const url = bot.username
        ? `https://t.me/${bot.username}?start=${encodeURIComponent(link.source)}`
        : null;
      return {
        id: link.id,
        source: link.source,
        link: url,
        created_at: link.createdAt,
        updated_at: link.updatedAt,
      };
    });

    return res.json(linksWithUrls);
  } catch (error) {
    console.error('Error getting referral links:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/bots/:botId/referral-links - Создать новую реферальную ссылку
router.post('/:botId/referral-links', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);

    if (isNaN(botId)) {
      return res.status(400).json({ detail: 'Invalid bot ID' });
    }

    const body = ReferralLinkCreateSchema.parse(req.body);

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

    if (!bot.username) {
      return res.status(400).json({ detail: 'Bot must have a username to create referral links' });
    }

    // Проверяем, что ссылка с таким source еще не существует
    const existing = await prisma.referralLink.findUnique({
      where: {
        botId_source: {
          botId,
          source: body.source.trim(),
        },
      },
    });

    if (existing) {
      return res.status(409).json({ detail: 'Referral link with this source already exists' });
    }

    // Создаем реферальную ссылку
    const referralLink = await prisma.referralLink.create({
      data: {
        botId,
        source: body.source.trim(),
      },
    });

    const url = `https://t.me/${bot.username}?start=${encodeURIComponent(referralLink.source)}`;

    return res.status(201).json({
      id: referralLink.id,
      source: referralLink.source,
      link: url,
      created_at: referralLink.createdAt,
      updated_at: referralLink.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error creating referral link:', error);
    // Логируем полную информацию об ошибке для отладки
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return res.status(500).json({ 
      detail: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// PUT /api/bots/:botId/referral-links/:linkId - Обновить реферальную ссылку
router.put('/:botId/referral-links/:linkId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const linkId = parseInt(req.params.linkId, 10);

    if (isNaN(botId) || isNaN(linkId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or link ID' });
    }

    const body = ReferralLinkUpdateSchema.parse(req.body);

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

    // Проверяем, что ссылка существует и принадлежит боту
    const existingLink = await prisma.referralLink.findFirst({
      where: {
        id: linkId,
        botId,
      },
    });

    if (!existingLink) {
      return res.status(404).json({ detail: 'Referral link not found' });
    }

    // Проверяем, что новый source не занят другой ссылкой
    if (body.source.trim() !== existingLink.source) {
      const duplicate = await prisma.referralLink.findUnique({
        where: {
          botId_source: {
            botId,
            source: body.source.trim(),
          },
        },
      });

      if (duplicate) {
        return res.status(409).json({ detail: 'Referral link with this source already exists' });
      }
    }

    // Обновляем ссылку
    const updatedLink = await prisma.referralLink.update({
      where: { id: linkId },
      data: {
        source: body.source.trim(),
      },
    });

    const url = bot.username
      ? `https://t.me/${bot.username}?start=${encodeURIComponent(updatedLink.source)}`
      : null;

    return res.json({
      id: updatedLink.id,
      source: updatedLink.source,
      link: url,
      created_at: updatedLink.createdAt,
      updated_at: updatedLink.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ detail: error.errors });
    }
    console.error('Error updating referral link:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// DELETE /api/bots/:botId/referral-links/:linkId - Удалить реферальную ссылку
router.delete('/:botId/referral-links/:linkId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botId = parseInt(req.params.botId, 10);
    const linkId = parseInt(req.params.linkId, 10);

    if (isNaN(botId) || isNaN(linkId)) {
      return res.status(400).json({ detail: 'Invalid bot ID or link ID' });
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

    // Проверяем, что ссылка существует и принадлежит боту
    const existingLink = await prisma.referralLink.findFirst({
      where: {
        id: linkId,
        botId,
      },
    });

    if (!existingLink) {
      return res.status(404).json({ detail: 'Referral link not found' });
    }

    // Удаляем ссылку
    await prisma.referralLink.delete({
      where: { id: linkId },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting referral link:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
