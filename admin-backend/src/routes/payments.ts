import { Router, Response } from 'express';
import { requireAdmin, type AuthRequest } from '../auth.js';
import { getDb, generateInvoiceNumber, updateRevenueSummary } from '../database.js';

const router = Router();

// GET /api/payments?page=&status=
router.get('/', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = 30;
  const offset = (page - 1) * limit;
  const status = req.query.status as string;

  let where = '';
  const params: unknown[] = [];
  if (status) { where = 'WHERE p.status = ?'; params.push(status); }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM payments p ${where}`).get(...params) as { c: number }).c;

  const payments = db.prepare(`
    SELECT p.*, u.email, u.display_name, u.device_id, s.plan
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN subscriptions s ON p.subscription_id = s.id
    ${where}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ payments, total, page, pages: Math.ceil(total / limit) });
});

// POST /api/payments/:id/refund
router.post('/:id/refund', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const paymentId = parseInt(req.params.id as string, 10);
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as { id: number; status: string; subscription_id: number | null } | undefined;

  if (!payment) { res.status(404).json({ error: 'Giao dịch không tồn tại.' }); return; }
  if (payment.status !== 'completed') { res.status(400).json({ error: 'Chỉ hoàn tiền giao dịch đã hoàn tất.' }); return; }

  db.prepare("UPDATE payments SET status = 'refunded' WHERE id = ?").run(paymentId);

  if (payment.subscription_id) {
    db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?").run(payment.subscription_id);
  }

  // Update revenue summary
  const now = new Date();
  updateRevenueSummary(now.getFullYear(), now.getMonth() + 1);

  res.json({ ok: true });
});

// GET /api/payments/export?year=&month= — Export CSV cho báo cáo thuế HKD
router.get('/export', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
  const month = parseInt(req.query.month as string, 10) || 0;

  let where = "WHERE p.status = 'completed'";
  const params: unknown[] = [];

  if (month > 0) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    where += ' AND p.completed_at >= ? AND p.completed_at < ?';
    params.push(start, end);
  } else {
    where += ' AND p.completed_at >= ? AND p.completed_at < ?';
    params.push(`${year}-01-01`, `${year + 1}-01-01`);
  }

  const payments = db.prepare(`
    SELECT p.invoice_number, p.amount, p.method, p.completed_at, p.note,
           u.email, u.display_name, s.plan
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN subscriptions s ON p.subscription_id = s.id
    ${where}
    ORDER BY p.completed_at ASC
  `).all(...params) as Array<Record<string, unknown>>;

  // CSV header
  const header = 'Số HĐ,Ngày,Khách hàng,Email,Gói,Phương thức,Số tiền (VND),Ghi chú\n';
  const rows = payments.map((p) =>
    [
      p.invoice_number || '',
      p.completed_at || '',
      p.display_name || '',
      p.email || '',
      p.plan || '',
      p.method || '',
      p.amount || 0,
      (p.note || '').toString().replace(/,/g, ';'),
    ].join(',')
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="doanh-thu-${year}${month ? '-' + String(month).padStart(2, '0') : ''}.csv"`);
  res.send('\uFEFF' + header + rows); // BOM for Excel UTF-8
});

export default router;
