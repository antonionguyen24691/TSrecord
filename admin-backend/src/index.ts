import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './database.js';
import adminRoutes from './routes/admin.js';
import statsRoutes from './routes/stats.js';
import usersRoutes from './routes/users.js';
import paymentsRoutes from './routes/payments.js';
import promoCodesRoutes from './routes/promoCodes.js';
import configRoutes from './routes/config.js';
import webhooksRoutes from './routes/webhooks.js';
import clientRoutes from './routes/client.js';
import platformRoutes from './routes/platform.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({
  limit: '50mb',
  verify: (req: any, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/webhooks/')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── API routes ───────────────────────────────────────────────
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/promo-codes', promoCodesRoutes);
app.use('/api/config', configRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/v2', platformRoutes);

// ── Serve admin UI ───────────────────────────────────────────
const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Vercel imports the Express app. Local/Fly runs still use the SQLite backend.
if (!process.env.VERCEL) {
  getDb();
  console.log('[TSrecord Admin] Local database initialized');
  app.listen(PORT, () => {
    console.log(`[TSrecord Admin] Server running at http://localhost:${PORT}`);
  });
}

export default app;
