import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { getDb, generateInvoiceNumber, updateRevenueSummary } from '../database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ── Helper: get config value ─────────────────────────────────
const getConfig = (key: string): string => {
  const row = getDb().prepare('SELECT value FROM system_config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value || '';
};

// ── Helper: activate subscription after payment ──────────────
const activateSubscription = (
  userId: number,
  plan: string,
  durationMonths: number,
  amount: number,
  method: string,
  transactionRef: string,
  providerData: string
) => {
  const db = getDb();

  // Cancel existing active subs
  db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(userId);

  const months = Number(durationMonths) || 1;
  const expiresAt = plan.startsWith('own_key') || plan === 'lifetime'
    ? null
    : new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();

  // Determine request limit and ads status
  let requestsLimit: number | null = null;
  let adsEnabled = 1;
  let ownKeyPurchased = 0;

  if (plan === 'monthly_20') {
    requestsLimit = 20 * months;
    adsEnabled = 0;
  } else if (plan === 'monthly_50') {
    requestsLimit = 50 * months;
    adsEnabled = 0;
  } else if (plan === 'monthly_100') {
    requestsLimit = 100 * months;
    adsEnabled = 0;
  } else if (plan === 'promo') {
    requestsLimit = 20 * months;
    adsEnabled = 0;
  } else if (plan === 'own_key_ads') {
    ownKeyPurchased = 1;
    adsEnabled = 1;
  } else if (plan === 'own_key_no_ads') {
    ownKeyPurchased = 1;
    adsEnabled = 0;
  } else if (plan === 'disable_ads') {
    adsEnabled = 0;
  } else if (plan === 'lifetime') {
    ownKeyPurchased = 1;
    adsEnabled = 0;
  } else if (plan === 'monthly') {
    requestsLimit = 20 * months;
    adsEnabled = 1;
  }

  const sub = db.prepare(`
    INSERT INTO subscriptions (user_id, plan, status, expires_at, requests_limit, duration_months, ads_enabled, own_key_purchased)
    VALUES (?, ?, 'active', ?, ?, ?, ?, ?)
  `).run(userId, plan, expiresAt, requestsLimit, months, adsEnabled, ownKeyPurchased);

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
    } = req.body;

    // Parse content to extract user identifier and plan
    // Expected format: "TSRECORD <device_id_or_email> <PLAN> <DURATION_MONTHS>M"
    // e.g. TSRECORD USER123 MONTHLY_20 3M
    const contentStr = (content || '').toString().toUpperCase().trim();
    const match = contentStr.match(/TSRECORD\s+(\S+)\s+([A-Z0-9_]+)(?:\s+(\d+)M)?/);

    if (!match) {
      console.warn('[SePay] Unrecognized transfer content:', content);
      res.json({ ok: true, matched: false, reason: 'content_not_matched' });
      return;
    }

    const [, userIdentifier, planRaw, durationStr] = match;
    const plan = planRaw.toLowerCase();
    const durationMonths = durationStr ? parseInt(durationStr, 10) : 1;
    const amount = parseInt(transferAmount, 10) || 0;

    // Verify amount matches plan price with discount
    const priceKey = `${plan}_price`;
    let basePrice = parseInt(getConfig(priceKey), 10);
    if (isNaN(basePrice)) {
      if (plan === 'monthly') basePrice = parseInt(getConfig('monthly_price'), 10);
      else if (plan === 'lifetime') basePrice = parseInt(getConfig('lifetime_price'), 10);
      else basePrice = 0;
    }

    let expectedPrice = basePrice * durationMonths;
    if (durationMonths === 3) {
      const discount = parseInt(getConfig('discount_3m') || '3', 10);
      expectedPrice = Math.round(expectedPrice * (1 - discount / 100));
    } else if (durationMonths === 6) {
      const discount = parseInt(getConfig('discount_6m') || '5', 10);
      expectedPrice = Math.round(expectedPrice * (1 - discount / 100));
    } else if (durationMonths === 12) {
      const discount = parseInt(getConfig('discount_12m') || '8', 10);
      expectedPrice = Math.round(expectedPrice * (1 - discount / 100));
    }

    if (amount < expectedPrice - 1000) {
      console.warn(`[SePay] Amount ${amount} < expected ${expectedPrice} for ${plan} (${durationMonths}M)`);
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

    const result = activateSubscription(userId, plan, durationMonths, amount, 'sepay', txRef, JSON.stringify(req.body));

    console.log(`[SePay] Activated ${plan} (${durationMonths}M) for user ${userId}, invoice ${result.invoiceNumber}`);
    res.json({ ok: true, matched: true, ...result });
  } catch (error) {
    console.error('[SePay] Webhook processing error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── POST /api/webhooks/stripe ─────────────────────────────────
// Stripe gửi webhook khi thanh toán thẻ quốc tế thành công
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = getConfig('stripe_webhook_secret');
  const secretKey = getConfig('stripe_secret_key');

  if (!secretKey) {
    console.error('[Stripe] Stripe Secret Key is not configured in system config.');
    res.status(500).json({ error: 'Stripe is not configured' });
    return;
  }

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;

  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { deviceId, plan, durationMonths } = session.metadata || {};
    const amount = session.amount_total ? session.amount_total : 0;
    const transactionRef = session.id;

    if (!deviceId || !plan) {
      console.warn('[Stripe] Missing deviceId or plan in session metadata:', session.metadata);
      res.json({ received: true, error: 'missing_metadata' });
      return;
    }

    try {
      const userId = findOrCreateUser(deviceId);
      const months = durationMonths ? parseInt(durationMonths, 10) : 1;
      const currency = session.currency ? session.currency.toUpperCase() : 'VND';
      const actualAmount = currency === 'USD' ? amount / 100 : amount;

      const existing = getDb().prepare('SELECT id FROM payments WHERE transaction_ref = ?').get(transactionRef);
      if (!existing) {
        const result = activateSubscription(userId, plan, months, actualAmount, `stripe_${currency.toLowerCase()}`, transactionRef, JSON.stringify(session));
        console.log(`[Stripe] Activated ${plan} (${months}M) for user ${userId}, invoice ${result.invoiceNumber}`);
      }
    } catch (err: any) {
      console.error('[Stripe] Error activating subscription:', err);
      res.status(500).json({ error: 'Internal error' });
      return;
    }
  }

  res.json({ received: true });
});

// ── POST /api/webhooks/generic ───────────────────────────────
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
    const { userId, plan, amount, transactionRef, provider, durationMonths } = req.body;

    if (!userId || !plan || !amount) {
      res.status(400).json({ error: 'Missing userId, plan, or amount.' });
      return;
    }

    const userDbId = findOrCreateUser(userId);
    const txRef = transactionRef || `webhook-${uuidv4()}`;
    const months = durationMonths ? parseInt(durationMonths, 10) : 1;

    const existing = getDb().prepare('SELECT id FROM payments WHERE transaction_ref = ?').get(txRef);
    if (existing) {
      res.json({ ok: true, duplicate: true });
      return;
    }

    const result = activateSubscription(userDbId, plan, months, amount, provider || 'bank_transfer', txRef, JSON.stringify(req.body));
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[Webhook] Processing error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
