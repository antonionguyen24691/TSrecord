import { Router, Response } from 'express';
import { requireAdmin, type AuthRequest } from '../auth.js';
import { getDb } from '../database.js';

const router = Router();

// GET /api/config
router.get('/', requireAdmin, (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM system_config ORDER BY key ASC').all();
  res.json(rows);
});

// PUT /api/config
router.put('/', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const updates: Array<{ key: string; value: string }> = req.body;

  if (!Array.isArray(updates)) {
    res.status(400).json({ error: 'Body phải là array [{key, value}].' });
    return;
  }

  const stmt = db.prepare(
    "UPDATE system_config SET value = ?, updated_at = datetime('now') WHERE key = ?"
  );

  const tx = db.transaction(() => {
    for (const { key, value } of updates) {
      if (key && value !== undefined) {
        stmt.run(String(value), key);
      }
    }
  });
  tx();

  res.json({ ok: true, updated: updates.length });
});

// GET /api/config/payment-info — Thông tin thanh toán công khai cho client
router.get('/payment-info', (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const getVal = (key: string) =>
    (db.prepare('SELECT value FROM system_config WHERE key = ?').get(key) as { value: string } | undefined)?.value || '';

  res.json({
    monthlyPrice: parseInt(getVal('monthly_price'), 10) || 69000,
    lifetimePrice: parseInt(getVal('lifetime_price'), 10) || 999000,
    sepayEnabled: getVal('sepay_enabled') === 'true',
    bankAccount: getVal('sepay_bank_account'),
    bankName: getVal('sepay_bank_name'),
    accountName: getVal('sepay_account_name'),
    businessName: getVal('hkd_business_name'),
  });
});

export default router;
