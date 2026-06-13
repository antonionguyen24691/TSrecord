import type {
  EinvoiceProviderId,
  ProviderConfigSchema,
  ProviderIssueInput,
  ProviderIssueResult,
} from '../types.js';
import { issueInternalInvoice } from './internal.js';
import {
  getMisaFieldValues,
  isMisaConfigured,
  issueMisaInvoice,
  MISA_FIELDS,
} from './misa.js';
import {
  getViettelFieldValues,
  isViettelConfigured,
  issueViettelInvoice,
  VIETTEL_FIELDS,
} from './viettel.js';

export const issueWithEinvoiceProvider = async (
  provider: EinvoiceProviderId,
  input: ProviderIssueInput
): Promise<ProviderIssueResult> => {
  switch (provider) {
    case 'internal':
      return issueInternalInvoice(input);
    case 'viettel':
      return issueViettelInvoice(input);
    case 'misa':
      return issueMisaInvoice(input);
    case 'manual':
      return {
        providerReference: input.invoiceNumber,
        payload: {
          mode: 'manual',
          invoice: input.standardInvoice,
          note: 'Xuất thủ công trên cổng thuế hoặc phần mềm kế toán.',
        },
      };
    default:
      throw new Error(`Provider hóa đơn không hỗ trợ: ${provider}`);
  }
};

export const listProviderSchemas = (
  settings: Record<string, unknown>
): ProviderConfigSchema[] => [
  {
    id: 'internal',
    label: 'Hóa đơn thông thường (HTML)',
    description: 'Sinh hóa đơn chuẩn in/PDF ngay, không cần API bên thứ ba.',
    ready: true,
    fields: [],
    values: {},
  },
  {
    id: 'viettel',
    label: 'Viettel S-Invoice',
    description: 'Ô cấu hình API Viettel — điền xong sẽ gọi adapter (stub sẵn).',
    ready: isViettelConfigured(settings),
    fields: VIETTEL_FIELDS,
    values: getViettelFieldValues(settings),
  },
  {
    id: 'misa',
    label: 'MISA meInvoice',
    description: 'Ô cấu hình API MISA — điền xong sẽ gọi adapter (stub sẵn).',
    ready: isMisaConfigured(settings),
    fields: MISA_FIELDS,
    values: getMisaFieldValues(settings),
  },
  {
    id: 'manual',
    label: 'Thủ công',
    description: 'Chỉ lưu dữ liệu, admin tự xuất trên cổng khác.',
    ready: true,
    fields: [],
    values: {},
  },
];

export const normalizeProvider = (value?: string | null): EinvoiceProviderId => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'viettel' || normalized === 'misa' || normalized === 'manual') {
    return normalized;
  }
  return 'internal';
};
