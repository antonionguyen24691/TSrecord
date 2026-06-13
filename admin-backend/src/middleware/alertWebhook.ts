import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();

const postAlert = (payload: Record<string, unknown>) => {
  if (!webhookUrl) return;
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((error: unknown) => {
    logger.warn('Alert webhook delivery failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
};

export const alertWebhookMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!webhookUrl) {
    next();
    return;
  }

  res.on('finish', () => {
    if (res.statusCode < 500) return;
    postAlert({
      type: 'http_error',
      service: 'tsrecord-admin',
      statusCode: res.statusCode,
      method: req.method,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  });

  next();
};
