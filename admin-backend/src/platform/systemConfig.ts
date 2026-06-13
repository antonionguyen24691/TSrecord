const ENV_MAP: Record<string, string> = {
  system_google_client_id: 'SYSTEM_GOOGLE_CLIENT_ID',
  system_google_api_key: 'SYSTEM_GOOGLE_API_KEY',
  admin_gemini_api_key: 'ADMIN_GEMINI_API_KEY',
  admin_groq_api_key: 'ADMIN_GROQ_API_KEY',
  admin_openai_api_key: 'ADMIN_OPENAI_API_KEY',
  admin_assemblyai_api_key: 'ADMIN_ASSEMBLYAI_API_KEY',
  admob_app_id: 'ADMOB_APP_ID',
  admob_banner_id: 'ADMOB_BANNER_ID',
  admob_rewarded_id: 'ADMOB_REWARDED_ID',
  custom_banner_html: 'CUSTOM_BANNER_HTML',
  custom_banner_enabled: 'CUSTOM_BANNER_ENABLED',
  sepay_enabled: 'SEPAY_ENABLED',
  sepay_bank_name: 'SEPAY_BANK_NAME',
  sepay_bank_account: 'SEPAY_BANK_ACCOUNT',
  sepay_account_name: 'SEPAY_ACCOUNT_NAME',
  stripe_enabled: 'STRIPE_ENABLED',
  stripe_secret_key: 'STRIPE_SECRET_KEY',
  monthly_20_price: 'MONTHLY_20_PRICE',
  monthly_50_price: 'MONTHLY_50_PRICE',
  monthly_100_price: 'MONTHLY_100_PRICE',
  own_key_ads_price: 'OWN_KEY_ADS_PRICE',
  own_key_no_ads_price: 'OWN_KEY_NO_ADS_PRICE',
  disable_ads_price: 'DISABLE_ADS_PRICE',
  discount_3m: 'DISCOUNT_3M',
  discount_6m: 'DISCOUNT_6M',
  discount_12m: 'DISCOUNT_12M',
};

export const getPlatformSystemConfig = (key: string): string => {
  const envKey = ENV_MAP[key] ?? key.toUpperCase();
  return process.env[envKey]?.trim() || '';
};
