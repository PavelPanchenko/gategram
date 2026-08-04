import { Request, Response, NextFunction } from 'express';
import { notifyOwnerError } from '../services/errorNotifier';

function extractBotId(req: Request): number | undefined {
  const raw =
    (req.params as { botId?: string }).botId ||
    (typeof req.query.bot_id === 'string' ? req.query.bot_id : undefined);
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);

  if (!res.headersSent) {
    void notifyOwnerError({
      userId: req.user?.userId,
      botId: extractBotId(req),
      source: `api ${req.method} ${req.originalUrl || req.url}`,
      message: err.message || 'Internal server error',
      stack: err.stack,
    });
  }

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    detail: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
}
