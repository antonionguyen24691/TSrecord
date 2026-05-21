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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── API routes ───────────────────────────────────────────────
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/promo-codes', promoCodesRoutes);
app.use('/api/config', configRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/client', clientRoutes);

// ── Serve admin UI ───────────────────────────────────────────
const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ── Initialize DB and start ──────────────────────────────────
getDb();
console.log(`[TSrecord Admin] Database initialized`);

app.listen(PORT, () => {
  console.log(`[TSrecord Admin] Server running at http://localhost:${PORT}`);
  console.log(`[TSrecord Admin] Admin UI: http://localhost:${PORT}`);
  console.log(`[TSrecord Admin] Client API: http://localhost:${PORT}/api/client/license?device_id=...`);
});
