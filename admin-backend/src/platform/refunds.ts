import Stripe from 'stripe';
import { one, withTransaction } from './database.js';

type PaidOrder = {
  id: string;
  order_code: string;
  user_id: string;
  provider: string;
  status: string;
  currency: string;
  amount_minor: string;
  provider_reference: string | null;
};

export const refundOrder = async (input: {
  orderCode: string;
  reason?: string;
  stripeSecretKey?: string;
}) => withTransaction(async (client) => {
  const orderResult = await client.query<PaidOrder>(
    `SELECT id, order_code, user_id, provider, status, currency, amount_minor, provider_reference
     FROM orders_v2
     WHERE order_code = $1
     FOR UPDATE`,
    [input.orderCode.toUpperCase()]
  );
  const order = orderResult.rows[0];
  if (!order) throw new Error('Không tìm thấy đơn hàng.');
  if (order.status !== 'paid') throw new Error('Chỉ hoàn tiền được đơn đã thanh toán.');
  if (order.provider !== 'stripe') {
    throw new Error('Hoàn tiền tự động hiện chỉ hỗ trợ Stripe. SePay cần xử lý thủ công.');
  }

  const secretKey = input.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY chưa được cấu hình.');
  if (!order.provider_reference) throw new Error('Đơn hàng thiếu mã tham chiếu Stripe.');

  const stripe = new Stripe(secretKey);
  const refund = await stripe.refunds.create({
    payment_intent: order.provider_reference,
    reason: 'requested_by_customer',
    metadata: {
      orderCode: order.order_code,
      reason: input.reason || 'admin_refund',
    },
  });

  await client.query(
    `UPDATE orders_v2
     SET status = 'refunded', updated_at = now()
     WHERE id = $1`,
    [order.id]
  );

  await client.query(
    `UPDATE entitlements_v2
     SET status = 'revoked'
     WHERE user_id = $1 AND source_order_id = $2 AND status = 'active'`,
    [order.user_id, order.id]
  );

  const organization = await client.query<{ id: string }>(
    'SELECT id FROM organization_profiles_v2 WHERE is_default = true LIMIT 1'
  );

  await client.query(
    `INSERT INTO ledger_entries_v2
       (organization_id, order_id, user_id, entry_type, document_number, occurred_at,
        currency, gross_amount_minor, net_amount_minor, description, metadata)
     VALUES ($1, $2, $3, 'refund', $4, now(), $5, $6, $7, $8, $9::jsonb)`,
    [
      organization.rows[0]?.id ?? null,
      order.id,
      order.user_id,
      `RF-${order.order_code}`,
      order.currency,
      -Number(order.amount_minor),
      -Number(order.amount_minor),
      input.reason || `Hoàn tiền đơn ${order.order_code}`,
      JSON.stringify({ stripeRefundId: refund.id, providerReference: order.provider_reference }),
    ]
  );

  return {
    ok: true,
    orderCode: order.order_code,
    stripeRefundId: refund.id,
    status: refund.status,
  };
});

export const getOrderForAdmin = (orderCode: string) =>
  one(
    `SELECT order_code, plan_code, provider, status, currency, amount_minor, paid_at, provider_reference
     FROM orders_v2 WHERE order_code = $1`,
    [orderCode.toUpperCase()]
  );
