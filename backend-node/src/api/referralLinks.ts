/**
 * API эндпоинты для управления реферальными ссылками.
 * В URL используется короткий code (≤64 символа, [A-Za-z0-9_-]), т.к. Telegram обрезает start-параметр.
 */

import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../core/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/** Генерирует короткий код для start-параметра (Telegram: до 64 символов, только A-Za-z0-9_-) */
function generateShortCode(): string {
  return crypto.randomBytes(8).toString('base64url');
}

function linkUrl(botUsername: string, codeOrPayload: string): string {
  return `https://t.me/${botUsername}?start=${encodeURIComponent(codeOrPayload)}`;
}

let warnedMissingReferralLinksTable = false;
function isMissingReferralLinksTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021' &&
    typeof (error as any).meta?.table === 'string' &&
    String((error as any).meta.table).includes('referral_links')
  );
}

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
    let referralLinks: Array<{ id: number; code: string | null; source: string; createdAt: Date; updatedAt: Date | null }> = [];
    try {
      referralLinks = await prisma.referralLink.findMany({
        where: { botId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      if (isMissingReferralLinksTableError(error)) {
        if (!warnedMissingReferralLinksTable) {
          warnedMissingReferralLinksTable = true;
          console.warn(
            '⚠️  referral_links table is missing. Referral links feature is disabled until DB is initialized (INIT_DB=1).'
          );
        }
        return res.json([]);
      }
      throw error;
    }

    // Проставляем короткий code старым ссылкам (у которых code ещё null)
    for (const link of referralLinks) {
      if (link.code != null) continue;
      let code = generateShortCode();
      for (let i = 0; i < 5; i++) {
        const taken = await prisma.referralLink.findFirst({ where: { botId, code } });
        if (!taken) break;
        code = generateShortCode();
      }
      await prisma.referralLink.update({ where: { id: link.id }, data: { code } });
      link.code = code;
    }

    // В URL только короткий code (лимит Telegram по start = 64 символа)
    const linksWithUrls = referralLinks.map((link) => {
      const payload = link.code ?? `r${link.id}`;
      const url = bot.username ? linkUrl(bot.username, payload) : null;
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
    let existing: any = null;
    try {
      existing = await prisma.referralLink.findUnique({
        where: {
          botId_source: {
            botId,
            source: body.source.trim(),
          },
        },
      });
    } catch (error) {
      if (isMissingReferralLinksTableError(error)) {
        return res.status(503).json({
          detail:
            'Referral links table is missing. Initialize database schema (run backend-node once with INIT_DB=1).',
        });
      }
      throw error;
    }

    if (existing) {
      return res.status(409).json({ detail: 'Referral link with this source already exists' });
    }

    // Уникальный короткий код для URL (лимит Telegram 64 символа)
    let code = generateShortCode();
    for (let i = 0; i < 5; i++) {
      const taken = await prisma.referralLink.findFirst({ where: { botId, code } });
      if (!taken) break;
      code = generateShortCode();
    }

    let referralLink: any;
    try {
      referralLink = await prisma.referralLink.create({
        data: {
          botId,
          code,
          source: body.source.trim(),
        },
      });
    } catch (error) {
      if (isMissingReferralLinksTableError(error)) {
        return res.status(503).json({
          detail:
            'Referral links table is missing. Initialize database schema (run backend-node once with INIT_DB=1).',
        });
      }
      throw error;
    }

    const url = linkUrl(bot.username!, referralLink.code ?? `r${referralLink.id}`);

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
    let existingLink: any;
    try {
      existingLink = await prisma.referralLink.findFirst({
        where: {
          id: linkId,
          botId,
        },
      });
    } catch (error) {
      if (isMissingReferralLinksTableError(error)) {
        return res.status(503).json({
          detail:
            'Referral links table is missing. Initialize database schema (run backend-node once with INIT_DB=1).',
        });
      }
      throw error;
    }

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
    let updatedLink: any;
    try {
      updatedLink = await prisma.referralLink.update({
        where: { id: linkId },
        data: {
          source: body.source.trim(),
        },
      });
    } catch (error) {
      if (isMissingReferralLinksTableError(error)) {
        return res.status(503).json({
          detail:
            'Referral links table is missing. Initialize database schema (run backend-node once with INIT_DB=1).',
        });
      }
      throw error;
    }

    const payload = updatedLink.code ?? `r${updatedLink.id}`;
    const url = bot.username ? linkUrl(bot.username, payload) : null;

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
    let existingLink: any;
    try {
      existingLink = await prisma.referralLink.findFirst({
        where: {
          id: linkId,
          botId,
        },
      });
    } catch (error) {
      if (isMissingReferralLinksTableError(error)) {
        return res.status(503).json({
          detail:
            'Referral links table is missing. Initialize database schema (run backend-node once with INIT_DB=1).',
        });
      }
      throw error;
    }

    if (!existingLink) {
      return res.status(404).json({ detail: 'Referral link not found' });
    }

    // Удаляем ссылку
    try {
      await prisma.referralLink.delete({
        where: { id: linkId },
      });
    } catch (error) {
      if (isMissingReferralLinksTableError(error)) {
        return res.status(503).json({
          detail:
            'Referral links table is missing. Initialize database schema (run backend-node once with INIT_DB=1).',
        });
      }
      throw error;
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting referral link:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
