import crypto from 'crypto';
import { query } from './database.js';
import type { Request, Response, NextFunction } from 'express';

const hashActorKey = (apiKey: string) =>
  crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);

export const recordAdminAudit = async (input: {
  actorKey?: string;
  action: string;
  resource?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) => {
  await query(
    `INSERT INTO admin_audit_logs_v2
       (actor_key_hash, action, resource, metadata, ip_address)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [
      input.actorKey ? hashActorKey(input.actorKey) : null,
      input.action,
      input.resource ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.ipAddress ?? null,
    ]
  );
};

export const adminAuditMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startedAt = Date.now();
  const actorKey = typeof req.headers['x-admin-api-key'] === 'string'
    ? req.headers['x-admin-api-key']
    : undefined;

  res.on('finish', () => {
    if (res.statusCode >= 500) return;
    recordAdminAudit({
      actorKey,
      action: `${req.method} ${req.path}`,
      resource: 'platform_admin',
      metadata: {
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        query: req.query,
      },
      ipAddress: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''),
    }).catch((error: unknown) => {
      console.error('[AuditLog]', error);
    });
  });

  next();
};
