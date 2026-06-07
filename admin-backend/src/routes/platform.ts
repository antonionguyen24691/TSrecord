import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { requirePlatformAdmin } from '../platform/auth.js';
import {
  createOrder,
  extractOrderCode,
  fulfillOrder,
  getOrderByCode,
  registerDevice,
} from '../platform/commerce.js';
import { one, query } from '../platform/database.js';
import { ensurePlatformSchema } from '../platform/schema.js';

const router = Router();

const asyncRoute = (
  handler: (req: Request, res: Response) => Promise<void>
) => (req: Request, res: Response) => {
  handler(req, res).catch((error: unknown) => {
    console.error('[Platform API]', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });
};

router.use((req, res, next) => {
  ensurePlatformSchema()
    .then(() => next())
    .catch((error: unknown) => {
      console.error('[Platform schema]', error);
      res.status(503).json({
        error: error instanceof Error ? error.message : 'Database initialization failed',
      });
    });
});

const getRawBody = (req: Request) =>
  (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));

const verifyHmac = (payload: Buffer, signature: string, secret: string) => {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const provided = signature.replace(/^sha256=/i, '');
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const verifySepayRequest = (req: Request) => {
  const apiKey = process.env.SEPAY_WEBHOOK_API_KEY;
  const hmacSecret = process.env.SEPAY_WEBHOOK_HMAC_SECRET;
  if (!apiKey && !hmacSecret) return false;

  if (apiKey) {
    const authorization = req.headers.authorization || '';
    if (authorization === `Apikey ${apiKey}` || authorization === `Bearer ${apiKey}`) {
      return true;
    }
  }

  if (hmacSecret) {
    const signature = String(
      req.headers['x-sepay-signature']
      || req.headers['x-webhook-signature']
      || ''
    );
    return Boolean(signature) && verifyHmac(getRawBody(req), signature, hmacSecret);
  }

  return false;
};

router.post('/devices/register', asyncRoute(async (req, res) => {
  const { deviceKey } = req.body;
  if (typeof deviceKey !== 'string' || deviceKey.trim().length < 8) {
    res.status(400).json({ error: 'deviceKey phải có ít nhất 8 ký tự.' });
    return;
  }

  const device = await registerDevice({
    deviceKey: deviceKey.trim(),
    email: req.body.email,
    displayName: req.body.displayName,
    platform: req.body.platform,
    appVersion: req.body.appVersion,
    locale: req.body.locale,
    model: req.body.model,
    osVersion: req.body.osVersion,
    metadata: req.body.metadata,
  });
  res.json({ ok: true, deviceId: device.id, userId: device.user_id });
}));

router.post('/orders', asyncRoute(async (req, res) => {
  const { deviceKey, planCode, provider } = req.body;
  if (
    typeof deviceKey !== 'string'
    || typeof planCode !== 'string'
    || !['sepay', 'stripe'].includes(provider)
  ) {
    res.status(400).json({ error: 'Thiếu deviceKey, planCode hoặc provider không hợp lệ.' });
    return;
  }

  if (
    provider === 'sepay'
    && (!process.env.SEPAY_BANK_ACCOUNT || !process.env.SEPAY_BANK_CODE)
  ) {
    res.status(503).json({ error: 'Chưa cấu hình SEPAY_BANK_ACCOUNT/SEPAY_BANK_CODE.' });
    return;
  }
  if (
    provider === 'stripe'
    && (!process.env.STRIPE_SECRET_KEY || !process.env.PUBLIC_APP_URL)
  ) {
    res.status(503).json({ error: 'Chưa cấu hình STRIPE_SECRET_KEY/PUBLIC_APP_URL.' });
    return;
  }

  const order = await createOrder({ deviceKey, planCode, provider });
  const response: Record<string, unknown> = {
    id: order.id,
    orderCode: order.order_code,
    status: order.status,
    provider: order.provider,
    currency: order.currency,
    amountMinor: Number(order.amount_minor),
  };

  if (provider === 'sepay') {
    const account = process.env.SEPAY_BANK_ACCOUNT!;
    const bank = process.env.SEPAY_BANK_CODE!;
    const params = new URLSearchParams({
      acc: account,
      bank,
      amount: order.amount_minor,
      des: order.order_code,
    });
    response.qrUrl = `https://qr.sepay.vn/img?${params.toString()}`;
    response.transferContent = order.order_code;
    response.accountName = process.env.SEPAY_ACCOUNT_NAME || '';
  }

  if (provider === 'stripe') {
    const secretKey = process.env.STRIPE_SECRET_KEY!;
    const publicUrl = process.env.PUBLIC_APP_URL!;
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: order.currency.toLowerCase(),
          unit_amount: Number(order.amount_minor),
          product_data: { name: `TSrecord - ${order.plan_code}` },
        },
        quantity: 1,
      }],
      success_url: `${publicUrl}?payment=success&order=${order.order_code}`,
      cancel_url: `${publicUrl}?payment=cancel&order=${order.order_code}`,
      metadata: {
        orderCode: order.order_code,
        orderId: order.id,
        planCode: order.plan_code,
      },
    });
    response.checkoutUrl = session.url;
  }

  res.status(201).json(response);
}));

router.get('/orders/:orderCode', asyncRoute(async (req, res) => {
  const order = await getOrderByCode(String(req.params.orderCode).toUpperCase());
  if (!order) {
    res.status(404).json({ error: 'Đơn hàng không tồn tại.' });
    return;
  }
  res.json({
    orderCode: order.order_code,
    planCode: order.plan_code,
    provider: order.provider,
    status: order.status,
    currency: order.currency,
    amountMinor: Number(order.amount_minor),
  });
}));

router.post('/webhooks/sepay', asyncRoute(async (req, res) => {
  if (!verifySepayRequest(req)) {
    res.status(401).json({ success: false, error: 'Webhook SePay không hợp lệ.' });
    return;
  }
  if (req.body.transferType && req.body.transferType !== 'in') {
    res.json({ success: true, ignored: true });
    return;
  }

  const orderCode = extractOrderCode(req.body.code, req.body.content);
  if (!orderCode) {
    res.json({ success: true, matched: false });
    return;
  }

  const eventId = String(req.body.id || req.body.referenceCode || '');
  const reference = String(req.body.referenceCode || req.body.id || '');
  if (!eventId || !reference) {
    res.status(400).json({ success: false, error: 'Webhook thiếu mã giao dịch.' });
    return;
  }

  const result = await fulfillOrder({
    orderCode,
    provider: 'sepay',
    providerEventId: eventId,
    providerReference: reference,
    amountMinor: Math.round(Number(req.body.transferAmount || 0)),
    currency: 'VND',
    eventType: 'bank_transfer_in',
    payload: req.body,
    signatureValid: true,
  });
  res.json({ success: true, matched: true, ...result });
}));

router.post('/webhooks/stripe', asyncRoute(async (req, res) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];
  if (!secretKey || !webhookSecret || typeof signature !== 'string') {
    res.status(503).json({ error: 'Stripe webhook chưa được cấu hình.' });
    return;
  }

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(getRawBody(req), signature, webhookSecret);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Stripe signature invalid',
    });
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') {
      res.json({ received: true, ignored: true });
      return;
    }
    const orderCode = session.metadata?.orderCode;
    if (!orderCode || session.amount_total == null || !session.currency) {
      res.status(400).json({ error: 'Stripe session thiếu order metadata.' });
      return;
    }
    await fulfillOrder({
      orderCode,
      provider: 'stripe',
      providerEventId: event.id,
      providerReference: session.payment_intent?.toString() || session.id,
      amountMinor: session.amount_total,
      currency: session.currency,
      eventType: event.type,
      payload: event,
      signatureValid: true,
    });
  }

  res.json({ received: true });
}));

router.get('/ads/runtime', asyncRoute(async (req, res) => {
  const deviceKey = String(req.query.deviceKey || '');
  const trigger = String(req.query.trigger || '');
  if (!deviceKey || !trigger) {
    res.status(400).json({ error: 'Thiếu deviceKey hoặc trigger.' });
    return;
  }

  const device = await one<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM devices_v2 WHERE device_key = $1 AND status = $2',
    [deviceKey, 'active']
  );
  if (!device) {
    res.json({ eligible: false, reason: 'device_not_registered' });
    return;
  }

  const entitlement = await one<{ ads_enabled: boolean; plan_code: string }>(
    `SELECT ads_enabled, plan_code
     FROM entitlements_v2
     WHERE user_id = $1 AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC LIMIT 1`,
    [device.user_id]
  );
  if (entitlement && !entitlement.ads_enabled) {
    res.json({ eligible: false, reason: 'ads_disabled_by_entitlement' });
    return;
  }

  const campaign = await one<{
    campaign_id: string;
    rule_id: string;
    provider: string;
    placement: string;
    format: string;
    provider_unit_id: string | null;
    creative: unknown;
    cooldown_seconds: number;
    max_per_day: number | null;
  }>(
    `SELECT c.id AS campaign_id, r.id AS rule_id, c.provider, c.placement, c.format,
            c.provider_unit_id, c.creative, r.cooldown_seconds, r.max_per_day
     FROM ad_rules_v2 r
     JOIN ad_campaigns_v2 c ON c.id = r.campaign_id
     WHERE r.enabled = true
       AND r.trigger_key = $1
       AND c.status = 'active'
       AND (c.starts_at IS NULL OR c.starts_at <= now())
       AND (c.ends_at IS NULL OR c.ends_at > now())
       AND (
         r.max_per_day IS NULL OR
         (SELECT count(*) FROM ad_events_v2 e
          WHERE e.rule_id = r.id AND e.device_id = $2
            AND e.event_type = 'impression'
            AND e.created_at >= date_trunc('day', now())) < r.max_per_day
       )
       AND (
         r.cooldown_seconds = 0 OR
         NOT EXISTS (
           SELECT 1 FROM ad_events_v2 e
           WHERE e.rule_id = r.id AND e.device_id = $2
             AND e.event_type = 'impression'
             AND e.created_at > now() - make_interval(secs => r.cooldown_seconds)
         )
       )
     ORDER BY c.priority ASC, c.created_at ASC
     LIMIT 1`,
    [trigger, device.id]
  );

  if (!campaign) {
    res.json({ eligible: false, reason: 'no_matching_campaign' });
    return;
  }

  await query(
    `INSERT INTO ad_events_v2
       (campaign_id, rule_id, user_id, device_id, event_type)
     VALUES ($1, $2, $3, $4, 'eligible')`,
    [campaign.campaign_id, campaign.rule_id, device.user_id, device.id]
  );
  res.json({ eligible: true, campaign });
}));

router.post('/ads/events', asyncRoute(async (req, res) => {
  const { deviceKey, campaignId, ruleId, eventType, revenueMicros, currency, metadata } = req.body;
  if (!deviceKey || !campaignId || !['impression', 'click', 'reward', 'dismiss'].includes(eventType)) {
    res.status(400).json({ error: 'Dữ liệu sự kiện quảng cáo không hợp lệ.' });
    return;
  }
  const device = await one<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM devices_v2 WHERE device_key = $1',
    [deviceKey]
  );
  if (!device) {
    res.status(404).json({ error: 'Thiết bị chưa đăng ký.' });
    return;
  }
  await query(
    `INSERT INTO ad_events_v2
       (campaign_id, rule_id, user_id, device_id, event_type, revenue_micros, currency, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      campaignId,
      ruleId || null,
      device.user_id,
      device.id,
      eventType,
      revenueMicros || null,
      currency || null,
      JSON.stringify(metadata || {}),
    ]
  );
  res.json({ ok: true });
}));

router.use('/admin', requirePlatformAdmin);

router.get('/admin/devices', asyncRoute(async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const rows = await query(
    `SELECT d.*, u.email, u.display_name,
            e.plan_code, e.expires_at AS entitlement_expires_at
     FROM devices_v2 d
     JOIN app_users_v2 u ON u.id = d.user_id
     LEFT JOIN LATERAL (
       SELECT plan_code, expires_at
       FROM entitlements_v2
       WHERE user_id = u.id AND status = 'active'
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC LIMIT 1
     ) e ON true
     ORDER BY d.last_seen_at DESC LIMIT $1`,
    [limit]
  );
  res.json(rows);
}));

router.get('/admin/revenue', asyncRoute(async (req, res) => {
  const from = String(req.query.from || `${new Date().getFullYear()}-01-01`);
  const to = String(req.query.to || `${new Date().getFullYear() + 1}-01-01`);
  const summary = await query(
    `SELECT currency,
            sum(CASE WHEN entry_type = 'sale' THEN gross_amount_minor ELSE 0 END) AS gross_revenue,
            sum(CASE WHEN entry_type = 'refund' THEN gross_amount_minor ELSE 0 END) AS refunds,
            sum(fee_amount_minor) AS payment_fees,
            sum(tax_amount_minor) AS recorded_tax,
            sum(net_amount_minor) AS net_amount
     FROM ledger_entries_v2
     WHERE occurred_at >= $1::timestamptz AND occurred_at < $2::timestamptz
     GROUP BY currency ORDER BY currency`,
    [from, to]
  );
  res.json({ from, to, summary });
}));

router.get('/admin/ledger', asyncRoute(async (req, res) => {
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 200));
  const rows = await query(
    `SELECT * FROM ledger_entries_v2
     ORDER BY occurred_at DESC LIMIT $1`,
    [limit]
  );
  res.json(rows);
}));

router.get('/admin/ledger.csv', asyncRoute(async (_req, res) => {
  const rows = await query<Record<string, unknown>>(
    `SELECT document_number, occurred_at, entry_type, currency, gross_amount_minor,
            fee_amount_minor, tax_amount_minor, net_amount_minor, description,
            counterparty_name, counterparty_tax_code
     FROM ledger_entries_v2 ORDER BY occurred_at ASC`
  );
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const header = [
    'Số chứng từ', 'Ngày', 'Loại', 'Tiền tệ', 'Doanh thu gộp',
    'Phí thanh toán', 'Thuế đã ghi nhận', 'Giá trị ròng',
    'Diễn giải', 'Đối tác', 'Mã số thuế đối tác',
  ];
  const csv = [
    header.map(escape).join(','),
    ...rows.map((row) => Object.values(row).map(escape).join(',')),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="so-doanh-thu.csv"');
  res.send(`\uFEFF${csv}`);
}));

router.get('/admin/ads/campaigns', asyncRoute(async (_req, res) => {
  res.json(await query(
    `SELECT c.*,
            COALESCE(json_agg(r.*) FILTER (WHERE r.id IS NOT NULL), '[]') AS rules
     FROM ad_campaigns_v2 c
     LEFT JOIN ad_rules_v2 r ON r.campaign_id = c.id
     GROUP BY c.id ORDER BY c.created_at DESC`
  ));
}));

router.post('/admin/ads/campaigns', asyncRoute(async (req, res) => {
  const { name, provider, placement, format, providerUnitId, creative, startsAt, endsAt, priority } = req.body;
  if (!name || !['admob', 'google_ads', 'custom'].includes(provider)) {
    res.status(400).json({ error: 'Chiến dịch quảng cáo không hợp lệ.' });
    return;
  }
  const campaign = await one(
    `INSERT INTO ad_campaigns_v2
       (name, provider, placement, format, provider_unit_id, creative, starts_at, ends_at, priority)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
     RETURNING *`,
    [
      name,
      provider,
      placement,
      format,
      providerUnitId || null,
      JSON.stringify(creative || {}),
      startsAt || null,
      endsAt || null,
      priority || 100,
    ]
  );
  res.status(201).json(campaign);
}));

router.post('/admin/ads/campaigns/:id/rules', asyncRoute(async (req, res) => {
  const { triggerKey, cooldownSeconds, maxPerDay, target } = req.body;
  if (!triggerKey) {
    res.status(400).json({ error: 'Thiếu triggerKey.' });
    return;
  }
  const rule = await one(
    `INSERT INTO ad_rules_v2
       (campaign_id, trigger_key, cooldown_seconds, max_per_day, target)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING *`,
    [
      req.params.id,
      triggerKey,
      Math.max(0, Number(cooldownSeconds) || 0),
      maxPerDay || null,
      JSON.stringify(target || {}),
    ]
  );
  res.status(201).json(rule);
}));

router.patch('/admin/ads/campaigns/:id/status', asyncRoute(async (req, res) => {
  const status = req.body.status;
  if (!['draft', 'active', 'paused', 'ended'].includes(status)) {
    res.status(400).json({ error: 'Trạng thái chiến dịch không hợp lệ.' });
    return;
  }
  const campaign = await one(
    `UPDATE ad_campaigns_v2 SET status = $2, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.id, status]
  );
  res.json(campaign);
}));

router.put('/admin/organization', asyncRoute(async (req, res) => {
  const {
    legalName, entityType, taxCode, address, accountingBasis,
    vatRate, incomeTaxRate, corporateTaxRate, einvoiceProvider, einvoiceEnabled, settings,
  } = req.body;
  if (!legalName || !['household_business', 'company'].includes(entityType)) {
    res.status(400).json({ error: 'Hồ sơ pháp lý không hợp lệ.' });
    return;
  }
  await query('UPDATE organization_profiles_v2 SET is_default = false WHERE is_default = true');
  const profile = await one(
    `INSERT INTO organization_profiles_v2
       (legal_name, entity_type, tax_code, address, accounting_basis, vat_rate,
        income_tax_rate, corporate_tax_rate, einvoice_provider, einvoice_enabled,
        settings, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, true)
     RETURNING *`,
    [
      legalName,
      entityType,
      taxCode || null,
      address || null,
      accountingBasis || 'configured',
      vatRate ?? null,
      incomeTaxRate ?? null,
      corporateTaxRate ?? null,
      einvoiceProvider || null,
      Boolean(einvoiceEnabled),
      JSON.stringify(settings || {}),
    ]
  );
  res.json(profile);
}));

export default router;
