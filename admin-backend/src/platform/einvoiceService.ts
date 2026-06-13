import { one, query } from './database.js';
import { logger } from '../utils/logger.js';
import {
  issueWithEinvoiceProvider,
  listProviderSchemas,
  normalizeProvider,
} from './einvoice/providers/index.js';
import { renderStandardInvoiceHtml } from './einvoice/renderer.js';
import type { EinvoiceProviderId, StandardInvoiceData } from './einvoice/types.js';

type OrganizationRow = {
  id: string;
  legal_name: string;
  tax_code: string | null;
  address: string | null;
  entity_type: string;
  einvoice_provider: string | null;
  einvoice_enabled: boolean;
  vat_rate: string | null;
  settings: Record<string, unknown>;
};

type OrderContext = {
  id: string;
  order_code: string;
  user_id: string;
  plan_code: string;
  plan_name: string;
  provider: string;
  currency: string;
  amount_minor: string;
  paid_at: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
};

type EinvoiceDocumentRow = {
  id: string;
  order_id: string;
  status: string;
  invoice_number: string | null;
  provider_reference: string | null;
  issued_at: string | null;
  error_message: string | null;
  payload?: Record<string, unknown>;
};

const nextInvoiceNumber = (orderCode: string) =>
  `HD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${orderCode.slice(-8)}`;

const calcTaxAmount = (grossMinor: number, vatRate: number | null): number => {
  if (!vatRate || vatRate <= 0) return 0;
  return Math.round(grossMinor * vatRate / (100 + vatRate));
};

const formatIssuedDate = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const paymentMethodLabel = (provider: string): string => {
  if (provider === 'sepay') return 'Chuyển khoản ngân hàng (SePay)';
  if (provider === 'stripe') return 'Thẻ quốc tế (Stripe)';
  if (provider === 'manual') return 'Thanh toán thủ công';
  return provider;
};

const buildStandardInvoice = (
  input: {
    invoiceNumber: string;
    order: OrderContext;
    organization: OrganizationRow;
    taxAmountMinor: number;
  }
): StandardInvoiceData => {
  const grossMinor = Number(input.order.amount_minor);
  const vatRate = input.organization.vat_rate ? Number(input.organization.vat_rate) : null;
  const issuedAt = input.order.paid_at || new Date().toISOString();

  return {
    invoiceNumber: input.invoiceNumber,
    issuedAt: formatIssuedDate(issuedAt),
    orderCode: input.order.order_code,
    seller: {
      legalName: input.organization.legal_name,
      taxCode: input.organization.tax_code,
      address: input.organization.address,
      entityType: input.organization.entity_type,
    },
    buyer: {
      name: input.order.buyer_name || 'Khách hàng cá nhân',
      taxCode: null,
      email: input.order.buyer_email,
    },
    currency: input.order.currency,
    lineItems: [{
      name: `Dịch vụ TSrecord — ${input.order.plan_name || input.order.plan_code}`,
      unit: 'Gói',
      quantity: 1,
      unitPriceMinor: grossMinor,
      amountMinor: grossMinor,
    }],
    grossAmountMinor: grossMinor,
    vatRate,
    taxAmountMinor: input.taxAmountMinor,
    netAmountMinor: grossMinor - input.taxAmountMinor,
    paymentMethod: paymentMethodLabel(input.order.provider),
    note: 'Hóa đơn điện tử thông thường do hệ thống TSrecord sinh tự động.',
  };
};

const getDefaultOrganization = () =>
  one<OrganizationRow>(
    `SELECT id, legal_name, tax_code, address, entity_type,
            einvoice_provider, einvoice_enabled, vat_rate, settings
     FROM organization_profiles_v2
     WHERE is_default = true
     LIMIT 1`
  );

const canIssueForProvider = (
  provider: EinvoiceProviderId,
  organization: OrganizationRow
): string | null => {
  if (!organization.legal_name?.trim()) {
    return 'Chưa cấu hình hồ sơ pháp lý (legal_name).';
  }
  if (provider === 'internal' || provider === 'manual') {
    return null;
  }
  if (!organization.einvoice_enabled) {
    return 'Bật einvoice_enabled trong hồ sơ tổ chức để dùng provider API.';
  }
  return null;
};

export const getEinvoiceProviderConfig = async () => {
  const organization = await getDefaultOrganization();
  return {
    organization,
    providers: listProviderSchemas(organization?.settings || {}),
    activeProvider: normalizeProvider(organization?.einvoice_provider),
    einvoiceEnabled: Boolean(organization?.einvoice_enabled),
  };
};

export const issueEinvoiceForOrder = async (
  orderId: string,
  options?: { force?: boolean }
): Promise<EinvoiceDocumentRow | null> => {
  const existing = await one<EinvoiceDocumentRow>(
    `SELECT id, order_id, status, invoice_number, provider_reference, issued_at, error_message
     FROM einvoice_documents_v2
     WHERE order_id = $1 AND status IN ('issued', 'draft')
     ORDER BY created_at DESC
     LIMIT 1`,
    [orderId]
  );
  if (existing && !options?.force) {
    return existing;
  }

  const order = await one<OrderContext & { status: string }>(
    `SELECT o.id, o.order_code, o.user_id, o.plan_code, o.provider, o.currency,
            o.amount_minor, o.paid_at, o.status,
            p.name AS plan_name,
            u.email AS buyer_email,
            u.display_name AS buyer_name
     FROM orders_v2 o
     LEFT JOIN plans_v2 p ON p.code = o.plan_code
     LEFT JOIN app_users_v2 u ON u.id = o.user_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (!order || order.status !== 'paid' || !order.paid_at) return null;

  const organization = await getDefaultOrganization();
  if (!organization) {
    throw new Error('Chưa có hồ sơ tổ chức mặc định. Cấu hình qua PUT /api/v2/admin/organization.');
  }

  const provider = normalizeProvider(organization.einvoice_provider);
  const providerError = canIssueForProvider(provider, organization);
  if (providerError) {
    throw new Error(providerError);
  }

  const grossMinor = Number(order.amount_minor);
  const vatRate = organization.vat_rate ? Number(organization.vat_rate) : null;
  const taxAmountMinor = calcTaxAmount(grossMinor, vatRate);
  const invoiceNumber = nextInvoiceNumber(order.order_code);
  const standardInvoice = buildStandardInvoice({
    invoiceNumber,
    order,
    organization,
    taxAmountMinor,
  });

  const draft = await one<EinvoiceDocumentRow>(
    `INSERT INTO einvoice_documents_v2
       (order_id, organization_id, provider, status, invoice_number,
        buyer_name, amount_minor, currency, vat_rate, tax_amount_minor)
     VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9)
     RETURNING id, order_id, status, invoice_number, provider_reference, issued_at, error_message`,
    [
      order.id,
      organization.id,
      provider,
      invoiceNumber,
      standardInvoice.buyer.name,
      grossMinor,
      order.currency,
      vatRate,
      taxAmountMinor,
    ]
  );
  if (!draft) {
    throw new Error('Không tạo được bản nháp hóa đơn.');
  }

  try {
    const issued = await issueWithEinvoiceProvider(provider, {
      invoiceNumber,
      order,
      organization,
      taxAmountMinor,
      standardInvoice,
    });

    const payload = {
      ...issued.payload,
      ...(issued.html ? { html: issued.html } : {}),
    };

    return await one<EinvoiceDocumentRow>(
      `UPDATE einvoice_documents_v2
       SET status = 'issued',
           provider_reference = $2,
           payload = $3::jsonb,
           issued_at = now(),
           updated_at = now(),
           error_message = NULL
       WHERE id = $1
       RETURNING id, order_id, status, invoice_number, provider_reference, issued_at, error_message`,
      [draft.id, issued.providerReference, JSON.stringify(payload)]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể phát hành hóa đơn.';
    await query(
      `UPDATE einvoice_documents_v2
       SET status = 'failed', error_message = $2, updated_at = now()
       WHERE id = $1`,
      [draft.id, message]
    );
    logger.error('E-invoice issue failed', { orderId, error: message });
    throw new Error(message);
  }
};

export const scheduleEinvoiceIssue = (orderId: string): void => {
  void issueEinvoiceForOrder(orderId).catch((error: unknown) => {
    logger.error('E-invoice scheduler failed', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
};

export const listEinvoices = (limit = 200) =>
  query(
    `SELECT d.*, o.order_code, o.plan_code
     FROM einvoice_documents_v2 d
     JOIN orders_v2 o ON o.id = d.order_id
     ORDER BY d.created_at DESC
     LIMIT $1`,
    [limit]
  );

export const getEinvoiceByOrderCode = async (orderCode: string) =>
  one(
    `SELECT d.*, o.order_code, o.plan_code, o.status AS order_status
     FROM einvoice_documents_v2 d
     JOIN orders_v2 o ON o.id = d.order_id
     WHERE o.order_code = $1
     ORDER BY d.created_at DESC
     LIMIT 1`,
    [orderCode.toUpperCase()]
  );

export const getEinvoiceById = (id: string) =>
  one<EinvoiceDocumentRow & { order_code: string }>(
    `SELECT d.*, o.order_code
     FROM einvoice_documents_v2 d
     JOIN orders_v2 o ON o.id = d.order_id
     WHERE d.id = $1`,
    [id]
  );

export const renderEinvoiceHtml = (doc: EinvoiceDocumentRow & { payload?: Record<string, unknown> }): string => {
  const payload = doc.payload || {};
  if (typeof payload.html === 'string' && payload.html.trim()) {
    return payload.html;
  }
  const invoice = payload.invoice as StandardInvoiceData | undefined;
  if (invoice) {
    return renderStandardInvoiceHtml(invoice);
  }
  return `<!DOCTYPE html><html><body><p>Không có dữ liệu hóa đơn để hiển thị.</p></body></html>`;
};

export const listPendingEinvoiceOrders = (limit = 100) =>
  query(
    `SELECT o.id, o.order_code, o.plan_code, o.amount_minor, o.currency, o.paid_at, u.email
     FROM orders_v2 o
     LEFT JOIN app_users_v2 u ON u.id = o.user_id
     LEFT JOIN LATERAL (
       SELECT id FROM einvoice_documents_v2
       WHERE order_id = o.id AND status IN ('issued', 'draft')
       LIMIT 1
     ) d ON true
     WHERE o.status = 'paid' AND d.id IS NULL
     ORDER BY o.paid_at DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );

export const issuePendingEinvoices = async (limit = 50) => {
  const pending = await listPendingEinvoiceOrders(limit);
  const results: Array<{ orderCode: string; ok: boolean; error?: string }> = [];

  for (const row of pending) {
    const orderCode = String(row.order_code);
    try {
      await issueEinvoiceForOrder(String(row.id));
      results.push({ orderCode, ok: true });
    } catch (error) {
      results.push({
        orderCode,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    scanned: pending.length,
    issued: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
};

export const getDefaultOrganizationProfile = () => getDefaultOrganization();
