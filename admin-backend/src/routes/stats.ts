import { Router, Response } from 'express';
import { requireAdmin, type AuthRequest } from '../auth.js';
import { getDb } from '../database.js';

const router = Router();

// GET /api/stats/dashboard
router.get('/dashboard', requireAdmin, (_req: AuthRequest, res: Response) => {
  const db = getDb();

  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const activeSubscriptions = (db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'active'").get() as { c: number }).c;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthlyRevenue = (db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed' AND completed_at >= ?"
  ).get(monthStart) as { total: number }).total;

  const todayStart = now.toISOString().slice(0, 10);
  const todayUsage = (db.prepare(
    'SELECT COUNT(*) as c FROM usage_logs WHERE created_at >= ?'
  ).get(todayStart) as { c: number }).c;

  const recentPayments = db.prepare(`
    SELECT p.*, u.email, u.display_name, u.device_id
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC LIMIT 20
  `).all();

  const usageByType = db.prepare(`
    SELECT action, COUNT(*) as count
    FROM usage_logs
    WHERE created_at >= date('now', '-30 days')
    GROUP BY action
    ORDER BY count DESC
  `).all();

  const revenueByMonth = db.prepare(`
    SELECT * FROM revenue_monthly ORDER BY year DESC, month DESC LIMIT 12
  `).all();

  const planDistribution = db.prepare(`
    SELECT plan, COUNT(*) as count
    FROM subscriptions WHERE status = 'active'
    GROUP BY plan
  `).all();

  res.json({
    totalUsers,
    activeSubscriptions,
    monthlyRevenue,
    todayUsage,
    recentPayments,
    usageByType,
    revenueByMonth,
    planDistribution,
  });
});

// GET /api/stats/usage?from=&to=&action=
router.get('/usage', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { from, to, action } = req.query;

  let query = 'SELECT * FROM usage_logs WHERE 1=1';
  const params: unknown[] = [];

  if (from) { query += ' AND created_at >= ?'; params.push(from); }
  if (to) { query += ' AND created_at < ?'; params.push(to); }
  if (action) { query += ' AND action = ?'; params.push(action); }

  query += ' ORDER BY created_at DESC LIMIT 500';
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// GET /api/stats/revenue?year=
router.get('/revenue', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

  const months = db.prepare(
    'SELECT * FROM revenue_monthly WHERE year = ? ORDER BY month ASC'
  ).all(year);

  const yearTotal = db.prepare(`
    SELECT
      COALESCE(SUM(total_revenue), 0) as revenue,
      COALESCE(SUM(total_transactions), 0) as transactions,
      COALESCE(SUM(tax_amount), 0) as tax
    FROM revenue_monthly WHERE year = ?
  `).get(year);

  res.json({ year, months, yearTotal });
});

export default router;
