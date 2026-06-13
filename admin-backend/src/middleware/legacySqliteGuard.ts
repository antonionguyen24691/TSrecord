import type { Request, Response, NextFunction } from 'express';
import { usePostgresBackend } from '../runtime.js';

/**
 * Blocks legacy SQLite-only admin routes when running on PostgreSQL (Vercel).
 * Client routes and /api/v2 continue to work via the Postgres adapter.
 */
export const blockLegacySqliteRoutes = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!usePostgresBackend()) {
    next();
    return;
  }

  res.status(410).json({
    error: 'Legacy SQLite API không còn khả dụng trên môi trường PostgreSQL.',
    hint: 'Dùng /api/v2/admin/* với header X-Admin-Api-Key.',
    docs: '/admin-backend/docs/VERCEL_COMMERCE_BACKEND.md',
  });
};
