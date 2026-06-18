import { one, query, withTransaction } from './database.js';
import { getPlatformSystemConfig } from './systemConfig.js';
import { registerDevice } from './commerce.js';

export type LicenseSnapshot = {
  valid: boolean;
  plan: string | null;
  expiresAt: string | null;
  features: string[];
  userId: string | null;
  requestsLimit: number | null;
  requestsUsed: number;
  adsEnabled: number;
  ownKeyPurchased: number;
};

export type PostgresAuthResult = {
  status: 'paid' | 'free_ad';
  entitlementId?: string;
  adRewardId?: string;
};

export const buildFeatures = (planCode: string, adsEnabled: boolean, ownKeyEnabled: boolean): string[] => {
  const features = [
    'transcription',
    'meeting',
    'interview',
    'export',
    'workspace',
    'system_google_drive',
  ];

  const isSystemKeyPlan = planCode.startsWith('monthly_') || planCode === 'promo' || planCode === 'monthly';
  if (isSystemKeyPlan) {
    features.push('system_api_key');
  }

  const adsOff = !adsEnabled || isSystemKeyPlan || planCode === 'lifetime' || planCode === 'own_key_no_ads';
  if (adsOff) {
    features.push('disable_ads');
  }

  if (ownKeyEnabled || planCode.startsWith('own_key')) {
    features.push('own_key');
  }

  return features;
};

const ensureDevice = async (deviceKey: string) => {
  const existing = await one<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM devices_v2 WHERE device_key = $1 AND status = $2',
    [deviceKey, 'active']
  );
  if (existing) {
    await query(
      'UPDATE devices_v2 SET last_seen_at = now() WHERE id = $1',
      [existing.id]
    );
    return existing;
  }

  const registered = await registerDevice({ deviceKey });
  return { id: registered.id, user_id: registered.user_id };
};

export const getLicenseSnapshotPostgres = async (deviceKey: string): Promise<LicenseSnapshot> => {
  if (!deviceKey) {
    return {
      valid: false,
      plan: null,
      expiresAt: null,
      features: ['trial'],
      userId: null,
      requestsLimit: null,
      requestsUsed: 0,
      adsEnabled: 1,
      ownKeyPurchased: 0,
    };
  }

  const device = await ensureDevice(deviceKey);
  const entitlement = await one<{
    id: string;
    plan_code: string;
    expires_at: string | null;
    request_limit: number | null;
    requests_used: number;
    ads_enabled: boolean;
    status: string;
  }>(
    `SELECT id, plan_code, expires_at, request_limit, requests_used, ads_enabled, status
     FROM entitlements_v2
     WHERE user_id = $1 AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC LIMIT 1`,
    [device.user_id]
  );

  if (!entitlement) {
    return {
      valid: false,
      plan: null,
      expiresAt: null,
      features: ['trial'],
      userId: device.user_id,
      requestsLimit: null,
      requestsUsed: 0,
      adsEnabled: 1,
      ownKeyPurchased: 0,
    };
  }

  const plan = await one<{ own_key_enabled: boolean }>(
    'SELECT own_key_enabled FROM plans_v2 WHERE code = $1',
    [entitlement.plan_code]
  );

  const adsOff = !entitlement.ads_enabled
    || entitlement.plan_code.startsWith('monthly_')
    || entitlement.plan_code === 'own_key_no_ads';

  return {
    valid: true,
    plan: entitlement.plan_code,
    expiresAt: entitlement.expires_at,
    features: buildFeatures(
      entitlement.plan_code,
      entitlement.ads_enabled,
      plan?.own_key_enabled ?? false
    ),
    userId: device.user_id,
    requestsLimit: entitlement.request_limit,
    requestsUsed: entitlement.requests_used,
    adsEnabled: adsOff ? 0 : 1,
    ownKeyPurchased: plan?.own_key_enabled ? 1 : 0,
  };
};

export const getRuntimeConfigPostgres = async (deviceKey: string) => {
  const snapshot = await getLicenseSnapshotPostgres(deviceKey);
  return {
    features: snapshot.features,
    googleClientId: getPlatformSystemConfig('system_google_client_id'),
    googleApiKey: getPlatformSystemConfig('system_google_api_key'),
    requestsLimit: snapshot.requestsLimit,
    requestsUsed: snapshot.requestsUsed,
    adsEnabled: snapshot.adsEnabled,
    ownKeyPurchased: snapshot.ownKeyPurchased,
    admobAppId: getPlatformSystemConfig('admob_app_id'),
    admobBannerId: getPlatformSystemConfig('admob_banner_id'),
    admobRewardedId: getPlatformSystemConfig('admob_rewarded_id'),
    customBannerHtml: getPlatformSystemConfig('custom_banner_html'),
    customBannerEnabled: getPlatformSystemConfig('custom_banner_enabled') === 'true',
  };
};

export const recordAdWatchedPostgres = async (deviceKey: string) => {
  const device = await ensureDevice(deviceKey);
  await query(
    `INSERT INTO ad_rewards_v2 (user_id, device_id, status)
     VALUES ($1, $2, 'pending')`,
    [device.user_id, device.id]
  );
};

export const recordUsagePostgres = async (
  deviceKey: string | undefined,
  action: string,
  provider?: string,
  durationSeconds?: number,
  fileSizeBytes?: number
) => {
  if (!deviceKey) return;
  const device = await one<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM devices_v2 WHERE device_key = $1',
    [deviceKey]
  );
  if (!device) return;

  await query(
    `INSERT INTO usage_logs_v2
       (user_id, device_id, action, provider, duration_seconds, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      device.user_id,
      device.id,
      action,
      provider ?? null,
      durationSeconds ?? null,
      fileSizeBytes ?? null,
    ]
  );
};

export const authorizeAndPrepareRequestPostgres = async (
  deviceKey: string,
  durationSeconds?: number,
  context?: string
): Promise<PostgresAuthResult> => {
  const device = await ensureDevice(deviceKey);
  const entitlement = await one<{
    id: string;
    plan_code: string;
    request_limit: number | null;
    requests_used: number;
    expires_at: string | null;
  }>(
    `SELECT id, plan_code, request_limit, requests_used, expires_at
     FROM entitlements_v2
     WHERE user_id = $1 AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC LIMIT 1`,
    [device.user_id]
  );

  if (entitlement) {
    if (
      entitlement.request_limit !== null
      && entitlement.requests_used >= entitlement.request_limit
    ) {
      throw new Error('Gói dịch vụ của bạn đã dùng hết lượt. Vui lòng nâng cấp hoặc mua thêm lượt.');
    }
    return { status: 'paid', entitlementId: entitlement.id };
  }

  const pendingReward = await one<{ id: string }>(
    `SELECT id FROM ad_rewards_v2
     WHERE device_id = $1 AND status = 'pending'
     ORDER BY created_at ASC LIMIT 1`,
    [device.id]
  );

  if (!pendingReward) {
    throw new Error('Yêu cầu thanh toán: Vui lòng mua gói dịch vụ hoặc xem video quảng cáo để dịch dùng thử.');
  }

  if (context && ['meeting', 'interview', 'recording', 'realtime'].includes(context.toLowerCase())) {
    throw new Error('Bản dùng thử qua quảng cáo không hỗ trợ chế độ cuộc họp, phỏng vấn hoặc ghi âm.');
  }

  if (durationSeconds && durationSeconds > 305) {
    throw new Error('Bản dùng thử qua quảng cáo chỉ hỗ trợ xử lý tối đa 5 phút (300 giây) mỗi lần.');
  }

  return { status: 'free_ad', adRewardId: pendingReward.id };
};

export const completeRequestUsagePostgres = async (
  auth: PostgresAuthResult,
  durationSeconds?: number,
  isGeminiAnalysis = false
) => {
  if (auth.status === 'paid' && auth.entitlementId) {
    if (isGeminiAnalysis) {
      await query(
        `UPDATE entitlements_v2
         SET requests_used = requests_used + 1
         WHERE id = $1`,
        [auth.entitlementId]
      );
    } else {
      const duration = Number(durationSeconds) || 300;
      await query(
        `UPDATE entitlements_v2
         SET requests_used = requests_used + GREATEST(1, CEIL($2::numeric / 1800))
         WHERE id = $1`,
        [auth.entitlementId, duration]
      );
    }
    return;
  }

  if (auth.status === 'free_ad' && auth.adRewardId) {
    await query(
      `UPDATE ad_rewards_v2
       SET status = 'consumed', consumed_at = now()
       WHERE id = $1`,
      [auth.adRewardId]
    );
  }
};

export const getPaymentInfoPostgres = async () => {
  const plans = await query<{ code: string; price_vnd: string }>(
    'SELECT code, price_vnd FROM plans_v2 WHERE active = true ORDER BY price_vnd ASC'
  );
  const pricing = Object.fromEntries(
    plans.map((plan) => [plan.code, Number(plan.price_vnd)])
  );

  return {
    sepayEnabled: getPlatformSystemConfig('sepay_enabled') === 'true'
      || Boolean(process.env.SEPAY_BANK_ACCOUNT),
    bankName: getPlatformSystemConfig('sepay_bank_name') || process.env.SEPAY_BANK_CODE || '',
    accountNumber: getPlatformSystemConfig('sepay_bank_account') || process.env.SEPAY_BANK_ACCOUNT || '',
    accountName: getPlatformSystemConfig('sepay_account_name') || process.env.SEPAY_ACCOUNT_NAME || '',
    stripeEnabled: getPlatformSystemConfig('stripe_enabled') === 'true'
      || Boolean(process.env.STRIPE_SECRET_KEY),
    pricing,
    discounts: {
      '3M': Number(getPlatformSystemConfig('discount_3m') || '3'),
      '6M': Number(getPlatformSystemConfig('discount_6m') || '5'),
      '12M': Number(getPlatformSystemConfig('discount_12m') || '12'),
    },
    companyInfo: {
      phone: getPlatformSystemConfig('hkd_phone'),
    },
    zaloOaConfig: {
      followUrl: getPlatformSystemConfig('zalo_oa_follow_url'),
      pricingContactEnabled: getPlatformSystemConfig('pricing_contact_enabled') !== 'false',
      pricingContactLabel: getPlatformSystemConfig('pricing_contact_label'),
      pricingSalesPhone: getPlatformSystemConfig('pricing_sales_phone'),
      pricingZaloUrl: getPlatformSystemConfig('pricing_zalo_url'),
      pricingBotUrl: getPlatformSystemConfig('pricing_bot_url'),
    },
    backend: 'postgres',
    checkoutHint: 'Dùng POST /api/v2/orders với deviceKey và planCode.',
  };
};
