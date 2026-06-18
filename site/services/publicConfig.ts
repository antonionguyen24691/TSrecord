export type PricingContactConfig = {
  followUrl?: string;
  pricingContactEnabled?: boolean;
  pricingContactLabel?: string;
  pricingSalesPhone?: string;
  pricingZaloUrl?: string;
  pricingBotUrl?: string;
};

export type PublicPaymentInfo = {
  sepayEnabled?: boolean;
  stripeEnabled?: boolean;
  pricing?: Record<string, number>;
  companyInfo?: {
    phone?: string;
  };
  zaloOaConfig?: PricingContactConfig;
};

const getPublicBackendUrl = () =>
  ((import.meta.env.VITE_BACKEND_URL as string | undefined) || 'http://localhost:4000').replace(/\/+$/, '');

export const fetchPublicPaymentInfo = async (): Promise<PublicPaymentInfo | null> => {
  try {
    const response = await fetch(`${getPublicBackendUrl()}/api/client/payment-info`);
    if (!response.ok) return null;
    return await response.json() as PublicPaymentInfo;
  } catch {
    return null;
  }
};
