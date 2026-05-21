import { Router, Response } from 'express';
import { requireAdmin, type AuthRequest } from '../auth.js';
import { getDb } from '../database.js';

const router = Router();

// GET /api/users?page=&search=
router.get('/', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = 30;
  const offset = (page - 1) * limit;
  const search = (req.query.search as string || '').trim();

  let where = '';
  const params: unknown[] = [];
  if (search) {
    where = "WHERE u.email LIKE ? OR u.display_name LIKE ? OR u.device_id LIKE ?";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM users u ${where}`).get(...params) as { c: number }).c;

  const users = db.prepare(`
    SELECT u.*,
      s.plan as active_plan,
      s.status as sub_status,
      s.expires_at as sub_expires_at,
      (SELECT COUNT(*) FROM usage_logs ul WHERE ul.user_id = u.id) as usage_count
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ users, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/users/:id
router.get('/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) { res.status(404).json({ error: 'User không tồn tại.' }); return; }

  const subscriptions = db.prepare(
    'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  const payments = db.prepare(
    'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.id);

  const recentUsage = db.prepare(
    'SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.id);

  res.json({ user, subscriptions, payments, recentUsage });
});

// POST /api/users/:id/grant — Admin cấp subscription thủ công
router.post('/:id/grant', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = parseInt(req.params.id as string, 10);
  const { plan, durationMonths, note } = req.body;

  if (!['monthly', 'lifetime'].includes(plan)) {
    res.status(400).json({ error: 'Plan phải là monthly hoặc lifetime.' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) { res.status(404).json({ error: 'User không tồn tại.' }); return; }

  // Cancel existing active subs
  db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(userId);

  const expiresAt = plan === 'monthly'
    ? new Date(Date.now() + (durationMonths || 1) * 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const sub = db.prepare(`
    INSERT INTO subscriptions (user_id, plan, status, expires_at)
    VALUES (?, ?, 'active', ?)
  `).run(userId, plan, expiresAt);

  // Log as manual payment with 0 amount
  db.prepare(`
    INSERT INTO payments (user_id, subscription_id, amount, method, status, note, completed_at)
    VALUES (?, ?, 0, 'manual', 'completed', ?, datetime('now'))
  `).run(userId, sub.lastInsertRowid, note || `Admin grant: ${plan}`);

  res.json({ ok: true, subscriptionId: sub.lastInsertRowid });
});

// DELETE /api/users/:id/subscription — Hủy subscription
router.delete('/:id/subscription', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = parseInt(req.params.id as string, 10);
  const result = db.prepare(
    "UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'"
  ).run(userId);
  res.json({ ok: true, cancelled: result.changes });
});

export default router;
