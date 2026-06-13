import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { getJwtSecret } from '../config/production.js';

type DeviceTokenPayload = {
  deviceKey: string;
};

const getDeviceAuthSecret = (): string =>
  process.env.DEVICE_AUTH_SECRET?.trim() || getJwtSecret();

const TOKEN_TTL: jwt.SignOptions['expiresIn'] =
  (process.env.DEVICE_AUTH_TTL || '30d') as jwt.SignOptions['expiresIn'];

export const issueDeviceToken = (deviceKey: string): string =>
  jwt.sign({ deviceKey } satisfies DeviceTokenPayload, getDeviceAuthSecret(), {
    expiresIn: TOKEN_TTL,
  });

export const verifyDeviceToken = (token: string): DeviceTokenPayload | null => {
  try {
    const payload = jwt.verify(token, getDeviceAuthSecret()) as DeviceTokenPayload;
    if (!payload?.deviceKey || typeof payload.deviceKey !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
};

const extractDeviceKey = (req: Request): string | null => {
  const fromQuery = req.query.device_id;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();

  const body = req.body as { deviceId?: string; deviceKey?: string } | undefined;
  const fromBody = body?.deviceId || body?.deviceKey;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();

  return null;
};

const isDeviceAuthRequired = (): boolean =>
  process.env.NODE_ENV === 'production'
  || Boolean(process.env.VERCEL)
  || Boolean(process.env.DEVICE_AUTH_SECRET?.trim());

const PUBLIC_CLIENT_PATHS = new Set([
  '/payment-info',
]);

export const requireDeviceAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (PUBLIC_CLIENT_PATHS.has(req.path)) {
    next();
    return;
  }

  if (!isDeviceAuthRequired()) {
    next();
    return;
  }

  const deviceKey = extractDeviceKey(req);
  if (!deviceKey) {
    res.status(400).json({ error: 'Thiếu device_id hoặc deviceId.' });
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Thiếu device token. Gọi POST /api/v2/devices/register trước.' });
    return;
  }

  const payload = verifyDeviceToken(header.slice(7));
  if (!payload || payload.deviceKey !== deviceKey) {
    res.status(401).json({ error: 'Device token không hợp lệ.' });
    return;
  }

  next();
};
