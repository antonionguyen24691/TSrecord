import type { ProviderConfigField, ProviderIssueInput, ProviderIssueResult } from '../types.js';

export const MISA_FIELDS: ProviderConfigField[] = [
  { key: 'apiUrl', label: 'API URL', placeholder: 'https://api.meinvoice.misa.vn/...' },
  { key: 'appId', label: 'App ID' },
  { key: 'taxCode', label: 'MST doanh nghiệp' },
  { key: 'accessToken', label: 'Access token', secret: true },
  { key: 'invoiceTemplate', label: 'Mẫu hóa đơn' },
  { key: 'invoiceSeries', label: 'Ký hiệu' },
];

const readMisaConfig = (settings: Record<string, unknown>) => {
  const einvoice = settings.einvoice as Record<string, unknown> | undefined;
  const misa = einvoice?.misa as Record<string, string> | undefined;
  return {
    apiUrl: misa?.apiUrl?.trim() || process.env.MISA_EINVOICE_API_URL?.trim() || '',
    appId: misa?.appId?.trim() || process.env.MISA_EINVOICE_APP_ID?.trim() || '',
    taxCode: misa?.taxCode?.trim() || process.env.MISA_EINVOICE_TAX_CODE?.trim() || '',
    accessToken: misa?.accessToken?.trim() || process.env.MISA_EINVOICE_ACCESS_TOKEN?.trim() || '',
    invoiceTemplate: misa?.invoiceTemplate?.trim() || '',
    invoiceSeries: misa?.invoiceSeries?.trim() || '',
  };
};

export const isMisaConfigured = (settings: Record<string, unknown>): boolean => {
  const config = readMisaConfig(settings);
  return Boolean(config.apiUrl && config.appId && config.accessToken);
};

export const issueMisaInvoice = async (
  input: ProviderIssueInput
): Promise<ProviderIssueResult> => {
  const config = readMisaConfig(input.organization.settings);
  if (!isMisaConfigured(input.organization.settings)) {
    throw new Error('MISA e-invoice chưa cấu hình (apiUrl, appId, accessToken).');
  }

  const requestBody = {
    appId: config.appId,
    taxCode: config.taxCode || input.organization.tax_code,
    template: config.invoiceTemplate,
    series: config.invoiceSeries,
    invoice: input.standardInvoice,
    orderCode: input.order.order_code,
  };

  return {
    providerReference: `MISA-PENDING-${input.invoiceNumber}`,
    payload: {
      mode: 'misa_stub',
      configured: true,
      apiUrl: config.apiUrl,
      requestPreview: requestBody,
      message: 'Adapter MISA đã sẵn sàng. Điền credentials và bật gọi API trong provider adapter.',
    },
  };
};

export const getMisaFieldValues = (settings: Record<string, unknown>): Record<string, string> => {
  const config = readMisaConfig(settings);
  return {
    apiUrl: config.apiUrl,
    appId: config.appId,
    taxCode: config.taxCode,
    accessToken: config.accessToken ? '********' : '',
    invoiceTemplate: config.invoiceTemplate,
    invoiceSeries: config.invoiceSeries,
  };
};
