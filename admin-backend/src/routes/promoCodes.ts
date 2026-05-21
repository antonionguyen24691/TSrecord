import { Router, Response } from 'express';
import { requireAdmin, type AuthRequest } from '../auth.js';
import { getDb } from '../database.js';

const router = Router();

// GET /api/promo-codes
router.get('/', requireAdmin, (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const codes = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
  res.json(codes);
});

// POST /api/promo-codes
router.post('/', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { code, description, plan, durationMonths, maxUses, expiresAt } = req.body;

  if (!code || !plan) {
    res.status(400).json({ error: 'Thiếu mã code hoặc plan.' });
    return;
  }
  if (!['monthly', 'lifetime'].includes(plan)) {
    res.status(400).json({ error: 'Plan phải là monthly hoặc lifetime.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM promo_codes WHERE code = ?').get(code);
  if (existing) {
    res.status(409).json({ error: 'Mã code đã tồn tại.' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO promo_codes (code, description, plan, duration_months, max_uses, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    code.toUpperCase().trim(),
    description || null,
    plan,
    plan === 'monthly' ? (durationMonths || 1) : null,
    maxUses || 1,
    expiresAt || null
  );

  res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/promo-codes/:id
router.put('/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { description, maxUses, isActive, expiresAt } = req.body;

  db.prepare(`
    UPDATE promo_codes
    SET description = COALESCE(?, description),
        max_uses = COALESCE(?, max_uses),
        is_active = COALESCE(?, is_active),
        expires_at = COALESCE(?, expires_at)
    WHERE id = ?
  `).run(description, maxUses, isActive, expiresAt, req.params.id);

  res.json({ ok: true });
});

// DELETE /api/promo-codes/:id
router.delete('/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  getDb().prepare('DELETE FROM promo_codes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
