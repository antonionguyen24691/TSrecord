import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express from 'express';
import { initSentry } from './observability/sentry.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './database.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { blockLegacySqliteRoutes } from './middleware/legacySqliteGuard.js';
import { usePostgresBackend } from './runtime.js';
import { ensurePlatformSchema } from './platform/schema.js';
import { validateProductionConfig } from './config/production.js';
import { requireDeviceAuth } from './platform/deviceAuth.js';
import adminRoutes from './routes/admin.js';
import statsRoutes from './routes/stats.js';
import usersRoutes from './routes/users.js';
import paymentsRoutes from './routes/payments.js';
import promoCodesRoutes from './routes/promoCodes.js';
import configRoutes from './routes/config.js';
import webhooksRoutes from './routes/webhooks.js';
import clientRoutes from './routes/client.js';
import platformRoutes from './routes/platform.js';
import cmsRoutes from './routes/cms.js';
import { logger } from './utils/logger.js';
import { alertWebhookMiddleware } from './middleware/alertWebhook.js';

initSentry();
validateProductionConfig();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ── Middleware ────────────────────────────────────────────────
app.use(createCorsMiddleware());
app.use(rateLimitMiddleware);
app.use(alertWebhookMiddleware);
app.use(express.json({
  limit: '50mb',
  verify: (req: any, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/webhooks/')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof Error && err.message.includes('CORS policy')) {
    res.status(403).json({ error: err.message });
    return;
  }
  next(err);
});

// ── API routes ───────────────────────────────────────────────
// Legacy SQLite admin routes are retired on PostgreSQL/Vercel deployments.
app.use('/api/admin', blockLegacySqliteRoutes, adminRoutes);
app.use('/api/stats', blockLegacySqliteRoutes, statsRoutes);
app.use('/api/users', blockLegacySqliteRoutes, usersRoutes);
app.use('/api/payments', blockLegacySqliteRoutes, paymentsRoutes);
app.use('/api/promo-codes', blockLegacySqliteRoutes, promoCodesRoutes);
app.use('/api/config', blockLegacySqliteRoutes, configRoutes);
app.use('/api/webhooks', blockLegacySqliteRoutes, webhooksRoutes);
app.use('/api/client', requireDeviceAuth, clientRoutes);
app.use('/api/v2', platformRoutes);
app.use('/api/cms', cmsRoutes);

// ── Serve admin UI ───────────────────────────────────────────
const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    }
  },
}));
app.get('*', (req, res, next) => {
  if (req.path.includes('.')) {
    next();
    return;
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

if (process.env.SENTRY_DSN?.trim()) {
  Sentry.setupExpressErrorHandler(app);
}

// Vercel imports the Express app. Local/Fly runs still use the SQLite backend.
if (usePostgresBackend()) {
  ensurePlatformSchema().catch((error: unknown) => {
    logger.error('PostgreSQL schema init failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

if (!process.env.VERCEL) {
  if (usePostgresBackend()) {
    logger.info('PostgreSQL backend mode');
  } else {
    getDb();
    logger.info('SQLite backend initialized');
  }
  app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, url: `http://localhost:${PORT}` });
  });
}

export default app;
