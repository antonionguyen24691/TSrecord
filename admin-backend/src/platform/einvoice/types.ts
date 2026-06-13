export type EinvoiceProviderId = 'internal' | 'viettel' | 'misa' | 'manual';

export type EinvoiceLineItem = {
  name: string;
  unit: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
};

export type StandardInvoiceData = {
  invoiceNumber: string;
  issuedAt: string;
  orderCode: string;
  seller: {
    legalName: string;
    taxCode: string | null;
    address: string | null;
    entityType: string;
  };
  buyer: {
    name: string;
    taxCode: string | null;
    email: string | null;
  };
  currency: string;
  lineItems: EinvoiceLineItem[];
  grossAmountMinor: number;
  vatRate: number | null;
  taxAmountMinor: number;
  netAmountMinor: number;
  paymentMethod: string;
  note: string;
};

export type ProviderIssueInput = {
  invoiceNumber: string;
  order: {
    id: string;
    order_code: string;
    plan_code: string;
    plan_name: string;
    provider: string;
    currency: string;
    amount_minor: string;
    paid_at: string | null;
    buyer_email: string | null;
    buyer_name: string | null;
  };
  organization: {
    id: string;
    legal_name: string;
    tax_code: string | null;
    address: string | null;
    entity_type: string;
    vat_rate: string | null;
    settings: Record<string, unknown>;
  };
  taxAmountMinor: number;
  standardInvoice: StandardInvoiceData;
};

export type ProviderIssueResult = {
  providerReference: string;
  payload: Record<string, unknown>;
  html?: string;
};

export type ProviderConfigField = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
};

export type ProviderConfigSchema = {
  id: EinvoiceProviderId;
  label: string;
  description: string;
  ready: boolean;
  fields: ProviderConfigField[];
  values: Record<string, string>;
};
