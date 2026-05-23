import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb, generateInvoiceNumber, updateRevenueSummary } from '../database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ── Helper: get config value ─────────────────────────────────
const getConfig = (key: string): string => {
  const row = getDb().prepare('SELECT value FROM system_config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value || '';
};

// ── Helper: activate subscription after payment ──────────────
const activateSubscription = (userId: number, plan: 'monthly' | 'lifetime', amount: number, method: string, transactionRef: string, providerData: string) => {
  const db = getDb();

  // Cancel existing active subs
  db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(userId);

  const expiresAt = plan === 'monthly'
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const sub = db.prepare(`
    INSERT INTO subscriptions (user_id, plan, status, expires_at)
    VALUES (?, ?, 'active', ?)
  `).run(userId, plan, expiresAt);

  const invoiceNumber = generateInvoiceNumber();

  db.prepare(`
    INSERT INTO payments (user_id, subscription_id, amount, method, status, transaction_ref, provider_data, invoice_number, completed_at)
    VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, datetime('now'))
  `).run(userId, sub.lastInsertRowid, amount, method, transactionRef, providerData, invoiceNumber);

  // Update monthly revenue
  const now = new Date();
  updateRevenueSummary(now.getFullYear(), now.getMonth() + 1);

  return { subscriptionId: sub.lastInsertRowid, invoiceNumber };
};

// ── Helper: find or create user by identifier ────────────────
const findOrCreateUser = (identifier: string): number => {
  const db = getDb();

  // Try device_id first, then email
  const user = db.prepare('SELECT id FROM users WHERE device_id = ? OR email = ?').get(identifier, identifier) as { id: number } | undefined;

  if (!user) {
    const result = db.prepare('INSERT INTO users (device_id) VALUES (?)').run(identifier);
    return Number(result.lastInsertRowid);
  }

  return user.id;
};

// ── POST /api/webhooks/sepay ─────────────────────────────────
// SePay gửi webhook khi có giao dịch chuyển khoản khớp
// Docs: https://docs.sepay.vn
router.post('/sepay', (req: Request, res: Response) => {
  const secret = getConfig('sepay_webhook_secret');

  // Verify webhook signature if secret is configured
  if (secret) {
    const signature = req.headers['x-sepay-signature'] as string || '';
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (signature !== expected) {
      console.error('[SePay] Invalid webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  try {
    const {
      transferAmount,
      content,
      referenceCode,
      transactionDate: _transactionDate,
    } = req.body;

    // Parse content to extract user identifier and plan
    // Expected format: "TSRECORD <device_id_or_email> <MONTHLY|LIFETIME>"
    const contentStr = (content || '').toString().toUpperCase().trim();
    const match = contentStr.match(/TSRECORD\s+(\S+)\s+(MONTHLY|LIFETIME)/);

    if (!match) {
      console.warn('[SePay] Unrecognized transfer content:', content);
      // Still return 200 to acknowledge receipt
      res.json({ ok: true, matched: false, reason: 'content_not_matched' });
      return;
    }

    const [, userIdentifier, planStr] = match;
    const plan = planStr.toLowerCase() as 'monthly' | 'lifetime';
    const amount = parseInt(transferAmount, 10) || 0;

    // Verify amount matches plan price
    const expectedPrice = parseInt(getConfig(plan === 'monthly' ? 'monthly_price' : 'lifetime_price'), 10);
    if (amount < expectedPrice) {
      console.warn(`[SePay] Amount ${amount} < expected ${expectedPrice} for ${plan}`);
      res.json({ ok: true, matched: false, reason: 'insufficient_amount' });
      return;
    }

    const userId = findOrCreateUser(userIdentifier);
    const txRef = referenceCode || `sepay-${uuidv4()}`;

    // Check for duplicate transaction
    const existing = getDb().prepare('SELECT id FROM payments WHERE transaction_ref = ?').get(txRef);
    if (existing) {
      res.json({ ok: true, matched: true, duplicate: true });
      return;
    }

    const result = activateSubscription(userId, plan, amount, 'sepay', txRef, JSON.stringify(req.body));

    console.log(`[SePay] Activated ${plan} for user ${userId}, invoice ${result.invoiceNumber}`);
    res.json({ ok: true, matched: true, ...result });
  } catch (error) {
    console.error('[SePay] Webhook processing error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── POST /api/webhooks/generic ───────────────────────────────
// Webhook chung cho các nhà cung cấp thanh toán khác
router.post('/generic', (req: Request, res: Response) => {
  const secret = getConfig('webhook_generic_secret');

  if (secret) {
    const signature = req.headers['x-webhook-signature'] as string || '';
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (signature !== expected) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  try {
    const { userId, plan, amount, transactionRef, provider } = req.body;

    if (!userId || !plan || !amount) {
      res.status(400).json({ error: 'Missing userId, plan, or amount.' });
      return;
    }

    const userDbId = findOrCreateUser(userId);
    const txRef = transactionRef || `webhook-${uuidv4()}`;

    const existing = getDb().prepare('SELECT id FROM payments WHERE transaction_ref = ?').get(txRef);
    if (existing) {
      res.json({ ok: true, duplicate: true });
      return;
    }

    const result = activateSubscription(userDbId, plan, amount, provider || 'bank_transfer', txRef, JSON.stringify(req.body));
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[Webhook] Processing error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
