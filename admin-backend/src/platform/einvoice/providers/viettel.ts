import type { ProviderConfigField, ProviderIssueInput, ProviderIssueResult } from '../types.js';

export const VIETTEL_FIELDS: ProviderConfigField[] = [
  { key: 'apiUrl', label: 'API URL', placeholder: 'https://api-vinvoice.viettel.vn/...' },
  { key: 'username', label: 'Username' },
  { key: 'password', label: 'Password', secret: true },
  { key: 'templateCode', label: 'Mẫu hóa đơn' },
  { key: 'invoiceSeries', label: 'Ký hiệu hóa đơn' },
  { key: 'sellerTaxCode', label: 'MST người bán' },
];

const readViettelConfig = (settings: Record<string, unknown>) => {
  const einvoice = settings.einvoice as Record<string, unknown> | undefined;
  const viettel = einvoice?.viettel as Record<string, string> | undefined;
  return {
    apiUrl: viettel?.apiUrl?.trim() || process.env.VIETTEL_EINVOICE_API_URL?.trim() || '',
    username: viettel?.username?.trim() || process.env.VIETTEL_EINVOICE_USERNAME?.trim() || '',
    password: viettel?.password?.trim() || process.env.VIETTEL_EINVOICE_PASSWORD?.trim() || '',
    templateCode: viettel?.templateCode?.trim() || '',
    invoiceSeries: viettel?.invoiceSeries?.trim() || '',
    sellerTaxCode: viettel?.sellerTaxCode?.trim() || '',
  };
};

export const isViettelConfigured = (settings: Record<string, unknown>): boolean => {
  const config = readViettelConfig(settings);
  return Boolean(config.apiUrl && config.username && config.password);
};

export const issueViettelInvoice = async (
  input: ProviderIssueInput
): Promise<ProviderIssueResult> => {
  const config = readViettelConfig(input.organization.settings);
  if (!isViettelConfigured(input.organization.settings)) {
    throw new Error('Viettel e-invoice chưa cấu hình (apiUrl, username, password).');
  }

  // Ô sẵn cho API thật — hiện lưu payload chuẩn bị gửi.
  const requestBody = {
    templateCode: config.templateCode,
    invoiceSeries: config.invoiceSeries,
    sellerTaxCode: config.sellerTaxCode || input.organization.tax_code,
    buyer: input.standardInvoice.buyer,
    items: input.standardInvoice.lineItems,
    totalAmount: input.standardInvoice.grossAmountMinor,
    orderCode: input.order.order_code,
  };

  return {
    providerReference: `VIETTEL-PENDING-${input.invoiceNumber}`,
    payload: {
      mode: 'viettel_stub',
      configured: true,
      apiUrl: config.apiUrl,
      requestPreview: requestBody,
      message: 'Adapter Viettel đã sẵn sàng. Điền credentials và bật gọi API trong provider adapter.',
    },
  };
};

export const getViettelFieldValues = (settings: Record<string, unknown>): Record<string, string> => {
  const config = readViettelConfig(settings);
  return {
    apiUrl: config.apiUrl,
    username: config.username,
    password: config.password ? '********' : '',
    templateCode: config.templateCode,
    invoiceSeries: config.invoiceSeries,
    sellerTaxCode: config.sellerTaxCode,
  };
};
