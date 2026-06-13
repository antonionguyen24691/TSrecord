import { renderStandardInvoiceHtml } from '../renderer.js';
import type { ProviderIssueInput, ProviderIssueResult } from '../types.js';

export const issueInternalInvoice = (input: ProviderIssueInput): ProviderIssueResult => {
  const html = renderStandardInvoiceHtml(input.standardInvoice);
  return {
    providerReference: input.invoiceNumber,
    payload: {
      mode: 'internal',
      format: 'standard_vn_html',
      invoice: input.standardInvoice,
    },
    html,
  };
};
