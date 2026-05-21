import { Router, Request, Response } from 'express';
import { getDb } from '../database.js';
import type { PromoCode } from '../types.js';

const router = Router();

// ── GET /api/client/license?device_id= ───────────────────────
// Main app gọi API này để kiểm tra trạng thái subscription
router.get('/license', (req: Request, res: Response) => {
  const deviceId = req.query.device_id as string;
  if (!deviceId) {
    res.status(400).json({ valid: false, error: 'Thiếu device_id.' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE device_id = ?').get(deviceId) as { id: number } | undefined;

  if (!user) {
    res.json({ valid: false, plan: null, expiresAt: null, features: ['trial'] });
    return;
  }

  // Update last active
  db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?").run(user.id);

  const sub = db.prepare(
    "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(user.id) as { plan: string; expires_at: string | null } | undefined;

  if (!sub) {
    res.json({ valid: false, plan: null, expiresAt: null, features: ['trial'] });
    return;
  }

  // Check expiration for monthly plans
  if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
    db.prepare("UPDATE subscriptions SET status = 'expired' WHERE user_id = ? AND status = 'active'").run(user.id);
    res.json({ valid: false, plan: null, expiresAt: null, features: ['trial'] });
    return;
  }

  res.json({
    valid: true,
    plan: sub.plan,
    expiresAt: sub.expires_at,
    features: ['transcription', 'meeting', 'interview', 'export', 'workspace'],
  });
});

// ── POST /api/client/redeem ──────────────────────────────────
// User nhập promo code trong app
router.post('/redeem', (req: Request, res: Response) => {
  const { deviceId, code } = req.body;

  if (!deviceId || !code) {
    res.status(400).json({ ok: false, error: 'Thiếu device_id hoặc mã code.' });
    return;
  }

  const db = getDb();
  const promo = db.prepare(
    'SELECT * FROM promo_codes WHERE code = ? AND is_active = 1'
  ).get(code.toUpperCase().trim()) as PromoCode | undefined;

  if (!promo) {
    res.status(404).json({ ok: false, error: 'Mã code không tồn tại hoặc đã hết hạn.' });
    return;
  }

  if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
    res.status(410).json({ ok: false, error: 'Mã code đã hết lượt sử dụng.' });
    return;
  }

  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    res.status(410).json({ ok: false, error: 'Mã code đã hết hạn.' });
    return;
  }

  // Find or create user
  let user = db.prepare('SELECT id FROM users WHERE device_id = ?').get(deviceId) as { id: number } | undefined;
  if (!user) {
    const result = db.prepare('INSERT INTO users (device_id) VALUES (?)').run(deviceId);
    user = { id: Number(result.lastInsertRowid) };
  }

  // Cancel existing active subs
  db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(user.id);

  const expiresAt = promo.plan === 'monthly' && promo.duration_months
    ? new Date(Date.now() + promo.duration_months * 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  db.prepare(`
    INSERT INTO subscriptions (user_id, plan, status, expires_at, promo_code_id)
    VALUES (?, 'promo', 'active', ?, ?)
  `).run(user.id, expiresAt, promo.id);

  // Increment used count
  db.prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?').run(promo.id);

  res.json({
    ok: true,
    plan: promo.plan,
    expiresAt,
    message: promo.plan === 'lifetime'
      ? 'Kích hoạt thành công gói trọn đời!'
      : `Kích hoạt thành công gói ${promo.duration_months || 1} tháng!`,
  });
});

// ── POST /api/client/usage ───────────────────────────────────
// Main app gửi log sử dụng
router.post('/usage', (req: Request, res: Response) => {
  const { deviceId, action, provider, durationSeconds, fileSizeBytes } = req.body;

  if (!action) {
    res.status(400).json({ error: 'Thiếu action.' });
    return;
  }

  const db = getDb();
  const user = deviceId
    ? db.prepare('SELECT id FROM users WHERE device_id = ?').get(deviceId) as { id: number } | undefined
    : undefined;

  db.prepare(`
    INSERT INTO usage_logs (user_id, device_id, action, provider, duration_seconds, file_size_bytes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user?.id || null, deviceId || null, action, provider || null, durationSeconds || null, fileSizeBytes || null);

  res.json({ ok: true });
});

// ── GET /api/client/payment-info ─────────────────────────────
// Thông tin thanh toán cho user hiển thị trong app
router.get('/payment-info', (_req: Request, res: Response) => {
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
    transferFormat: 'TSRECORD <device_id> <MONTHLY|LIFETIME>',
  });
});

export default router;
