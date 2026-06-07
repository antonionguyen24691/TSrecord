import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const timingSafeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const requirePlatformAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const configuredKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers['x-admin-api-key'];

  if (!configuredKey) {
    res.status(503).json({ error: 'ADMIN_API_KEY is not configured.' });
    return;
  }

  if (typeof providedKey !== 'string' || !timingSafeEqual(providedKey, configuredKey)) {
    res.status(401).json({ error: 'Admin API key không hợp lệ.' });
    return;
  }

  next();
};
