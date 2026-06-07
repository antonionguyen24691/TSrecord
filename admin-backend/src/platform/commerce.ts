import crypto from 'crypto';
import { one, withTransaction } from './database.js';

type DeviceRow = {
  id: string;
  user_id: string;
  device_key: string;
};

type PlanRow = {
  code: string;
  duration_months: number | null;
  request_limit: number | null;
  price_vnd: string;
  price_usd_minor: number | null;
  ads_enabled: boolean;
  features: unknown;
};

type OrderRow = {
  id: string;
  order_code: string;
  user_id: string;
  device_id: string | null;
  plan_code: string;
  provider: string;
  status: string;
  currency: string;
  amount_minor: string;
};

export const registerDevice = async (input: {
  deviceKey: string;
  email?: string;
  displayName?: string;
  platform?: string;
  appVersion?: string;
  locale?: string;
  model?: string;
  osVersion?: string;
  metadata?: Record<string, unknown>;
}): Promise<DeviceRow> => withTransaction(async (client) => {
  const existing = await client.query<DeviceRow>(
    `SELECT id, user_id, device_key
     FROM devices_v2
     WHERE device_key = $1
     FOR UPDATE`,
    [input.deviceKey]
  );

  if (existing.rows[0]) {
    const device = existing.rows[0];
    await client.query(
      `UPDATE devices_v2
       SET platform = COALESCE($2, platform),
           app_version = COALESCE($3, app_version),
           locale = COALESCE($4, locale),
           model = COALESCE($5, model),
           os_version = COALESCE($6, os_version),
           metadata = metadata || $7::jsonb,
           last_seen_at = now()
       WHERE id = $1`,
      [
        device.id,
        input.platform ?? null,
        input.appVersion ?? null,
        input.locale ?? null,
        input.model ?? null,
        input.osVersion ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    return device;
  }

  const user = await client.query<{ id: string }>(
    `INSERT INTO app_users_v2 (email, display_name)
     VALUES ($1, $2)
     RETURNING id`,
    [input.email?.trim().toLowerCase() || null, input.displayName?.trim() || null]
  );

  const device = await client.query<DeviceRow>(
    `INSERT INTO devices_v2
       (user_id, device_key, platform, app_version, locale, model, os_version, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id, user_id, device_key`,
    [
      user.rows[0].id,
      input.deviceKey,
      input.platform ?? null,
      input.appVersion ?? null,
      input.locale ?? null,
      input.model ?? null,
      input.osVersion ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );

  return device.rows[0];
});

const createOrderCode = () =>
  `TSR${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

export const createOrder = async (input: {
  deviceKey: string;
  planCode: string;
  provider: 'sepay' | 'stripe';
}): Promise<OrderRow> => withTransaction(async (client) => {
  const device = await client.query<DeviceRow>(
    'SELECT id, user_id, device_key FROM devices_v2 WHERE device_key = $1 FOR UPDATE',
    [input.deviceKey]
  );
  if (!device.rows[0]) {
    throw new Error('Thiết bị chưa được đăng ký.');
  }

  const plan = await client.query<PlanRow>(
    'SELECT * FROM plans_v2 WHERE code = $1 AND active = true',
    [input.planCode]
  );
  if (!plan.rows[0]) {
    throw new Error('Gói dịch vụ không tồn tại hoặc đã ngừng bán.');
  }

  const currency = input.provider === 'sepay' ? 'VND' : 'USD';
  const amountMinor = input.provider === 'sepay'
    ? Number(plan.rows[0].price_vnd)
    : plan.rows[0].price_usd_minor;
  if (!amountMinor || amountMinor < 1) {
    throw new Error(`Gói ${input.planCode} chưa cấu hình giá cho ${currency}.`);
  }

  const order = await client.query<OrderRow>(
    `INSERT INTO orders_v2
       (order_code, user_id, device_id, plan_code, provider, currency, amount_minor, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + interval '20 minutes')
     RETURNING *`,
    [
      createOrderCode(),
      device.rows[0].user_id,
      device.rows[0].id,
      input.planCode,
      input.provider,
      currency,
      amountMinor,
    ]
  );

  return order.rows[0];
});

const nextDocumentNumber = (orderCode: string) =>
  `TSR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${orderCode.slice(-8)}`;

export const fulfillOrder = async (input: {
  orderCode: string;
  provider: 'sepay' | 'stripe' | 'manual';
  providerEventId: string;
  providerReference: string;
  amountMinor: number;
  currency: string;
  eventType: string;
  payload: unknown;
  signatureValid: boolean;
}) => withTransaction(async (client) => {
  const duplicate = await client.query(
    `SELECT id FROM payment_events_v2
     WHERE provider = $1 AND provider_event_id = $2`,
    [input.provider, input.providerEventId]
  );
  if (duplicate.rows[0]) {
    return { duplicate: true };
  }

  const orderResult = await client.query<OrderRow>(
    'SELECT * FROM orders_v2 WHERE order_code = $1 FOR UPDATE',
    [input.orderCode]
  );
  const order = orderResult.rows[0];
  if (!order) {
    throw new Error('Không tìm thấy đơn hàng khớp mã thanh toán.');
  }
  if (order.provider !== input.provider) {
    throw new Error('Nhà cung cấp thanh toán không khớp đơn hàng.');
  }
  if (order.status === 'paid') {
    return { duplicate: true, orderId: order.id };
  }
  if (order.currency !== input.currency.toUpperCase()) {
    throw new Error('Loại tiền thanh toán không khớp đơn hàng.');
  }
  if (input.amountMinor < Number(order.amount_minor)) {
    throw new Error('Số tiền nhận được thấp hơn giá trị đơn hàng.');
  }

  await client.query(
    `INSERT INTO payment_events_v2
       (provider, provider_event_id, event_type, order_id, signature_valid, payload, processed_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
    [
      input.provider,
      input.providerEventId,
      input.eventType,
      order.id,
      input.signatureValid,
      JSON.stringify(input.payload),
    ]
  );

  const planResult = await client.query<PlanRow>(
    'SELECT * FROM plans_v2 WHERE code = $1',
    [order.plan_code]
  );
  const plan = planResult.rows[0];
  if (!plan) throw new Error('Gói dịch vụ của đơn hàng không còn tồn tại.');

  await client.query(
    `UPDATE orders_v2
     SET status = 'paid',
         provider_reference = $2,
         paid_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [order.id, input.providerReference]
  );

  await client.query(
    `UPDATE entitlements_v2
     SET status = 'expired'
     WHERE user_id = $1
       AND status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at <= now()`,
    [order.user_id]
  );

  const current = await client.query<{
    id: string;
    expires_at: string | null;
    request_limit: number | null;
  }>(
    `SELECT id, expires_at, request_limit
     FROM entitlements_v2
     WHERE user_id = $1 AND status = 'active' AND plan_code = $2
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [order.user_id, plan.code]
  );

  if (current.rows[0]) {
    await client.query(
      `UPDATE entitlements_v2
       SET source_order_id = $2,
           expires_at = CASE
             WHEN $3::integer IS NULL THEN NULL
             ELSE GREATEST(COALESCE(expires_at, now()), now()) + ($3 * interval '1 month')
           END,
           request_limit = CASE
             WHEN $4::integer IS NULL THEN request_limit
             ELSE COALESCE(request_limit, 0) + $4
           END,
           ads_enabled = $5,
           features = $6::jsonb
       WHERE id = $1`,
      [
        current.rows[0].id,
        order.id,
        plan.duration_months,
        plan.request_limit,
        plan.ads_enabled,
        JSON.stringify(plan.features ?? []),
      ]
    );
  } else {
    await client.query(
      `INSERT INTO entitlements_v2
         (user_id, source_order_id, plan_code, expires_at, request_limit, ads_enabled, features)
       VALUES (
         $1, $2, $3,
         CASE WHEN $4::integer IS NULL THEN NULL ELSE now() + ($4 * interval '1 month') END,
         $5, $6, $7::jsonb
       )`,
      [
        order.user_id,
        order.id,
        plan.code,
        plan.duration_months,
        plan.request_limit,
        plan.ads_enabled,
        JSON.stringify(plan.features ?? []),
      ]
    );
  }

  const organization = await client.query<{ id: string }>(
    'SELECT id FROM organization_profiles_v2 WHERE is_default = true LIMIT 1',
  );
  await client.query(
    `INSERT INTO ledger_entries_v2
       (organization_id, order_id, user_id, entry_type, document_number, occurred_at,
        currency, gross_amount_minor, net_amount_minor, description, metadata)
     VALUES ($1, $2, $3, 'sale', $4, now(), $5, $6, $6, $7, $8::jsonb)`,
    [
      organization.rows[0]?.id ?? null,
      order.id,
      order.user_id,
      nextDocumentNumber(order.order_code),
      order.currency,
      input.amountMinor,
      `Thanh toán gói ${order.plan_code}`,
      JSON.stringify({ provider: input.provider, providerReference: input.providerReference }),
    ]
  );

  return { duplicate: false, orderId: order.id, planCode: order.plan_code };
});

export const getOrderByCode = (orderCode: string) =>
  one<OrderRow>(
    `SELECT id, order_code, user_id, device_id, plan_code, provider, status, currency, amount_minor
     FROM orders_v2 WHERE order_code = $1`,
    [orderCode]
  );

export const extractOrderCode = (code?: unknown, content?: unknown) => {
  const direct = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (/^TSR[A-F0-9]{12}$/.test(direct)) return direct;
  const text = typeof content === 'string' ? content.toUpperCase() : '';
  return text.match(/\bTSR[A-F0-9]{12}\b/)?.[0] ?? null;
};
