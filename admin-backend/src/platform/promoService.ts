import { one, withTransaction } from './database.js';
import { registerDevice } from './commerce.js';

type PromoRow = {
  id: string;
  code: string;
  plan_code: string;
  duration_months: number | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
};

export const redeemPromoCodePostgres = async (deviceKey: string, rawCode: string) => {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    throw new Error('Mã code không hợp lệ.');
  }

  const device = await registerDevice({ deviceKey });

  return withTransaction(async (client) => {
    const promoResult = await client.query<PromoRow>(
      `SELECT id, code, plan_code, duration_months, max_uses, used_count, expires_at
       FROM promo_codes_v2
       WHERE upper(code) = $1 AND is_active = true
       FOR UPDATE`,
      [code]
    );
    const promo = promoResult.rows[0];
    if (!promo) {
      throw new Error('Mã code không tồn tại hoặc đã hết hạn.');
    }
    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
      throw new Error('Mã code đã hết lượt sử dụng.');
    }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      throw new Error('Mã code đã hết hạn.');
    }

    const plan = await client.query<{ duration_months: number | null; request_limit: number | null; ads_enabled: boolean; features: unknown }>(
      'SELECT duration_months, request_limit, ads_enabled, features FROM plans_v2 WHERE code = $1',
      [promo.plan_code]
    );
    if (!plan.rows[0]) {
      throw new Error('Gói promo không còn khả dụng.');
    }

    await client.query(
      `UPDATE entitlements_v2
       SET status = 'expired'
       WHERE user_id = $1 AND status = 'active'`,
      [device.user_id]
    );

    const months = promo.duration_months ?? plan.rows[0].duration_months;
    const expiresAt = months
      ? new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    await client.query(
      `INSERT INTO entitlements_v2
         (user_id, plan_code, expires_at, request_limit, ads_enabled, features, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [
        device.user_id,
        promo.plan_code,
        expiresAt,
        plan.rows[0].request_limit,
        plan.rows[0].ads_enabled,
        JSON.stringify(plan.rows[0].features ?? []),
        JSON.stringify({ promoCodeId: promo.id, promoCode: promo.code }),
      ]
    );

    await client.query(
      'UPDATE promo_codes_v2 SET used_count = used_count + 1 WHERE id = $1',
      [promo.id]
    );

    return {
      ok: true as const,
      plan: promo.plan_code,
      expiresAt,
      message: expiresAt
        ? `Kích hoạt thành công gói ${months || 1} tháng!`
        : 'Kích hoạt thành công gói promo!',
    };
  });
};

export const createPromoCode = async (input: {
  code: string;
  planCode: string;
  description?: string;
  durationMonths?: number;
  maxUses?: number;
  expiresAt?: string;
}) => one(
  `INSERT INTO promo_codes_v2
     (code, description, plan_code, duration_months, max_uses, expires_at)
   VALUES ($1, $2, $3, $4, $5, $6)
   RETURNING *`,
  [
    input.code.trim().toUpperCase(),
    input.description ?? null,
    input.planCode,
    input.durationMonths ?? null,
    input.maxUses ?? 1,
    input.expiresAt ?? null,
  ]
);
