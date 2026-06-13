import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getDb } from '../database.js';
import type { PromoCode } from '../types.js';
import { usePostgresBackend } from '../runtime.js';
import { getPlatformSystemConfig } from '../platform/systemConfig.js';
import { sanitizeUpstreamError } from '../utils/errorSanitizer.js';
import {
  authorizeAndPrepareRequestPostgres,
  completeRequestUsagePostgres,
  getLicenseSnapshotPostgres,
  getPaymentInfoPostgres,
  getRuntimeConfigPostgres,
  recordAdWatchedPostgres,
  recordUsagePostgres,
  type PostgresAuthResult,
} from '../platform/clientService.js';
import { redeemPromoCodePostgres } from '../platform/promoService.js';
import { consumeUploadSession } from '../platform/uploadSessions.js';
import {
  getKeyCandidates,
  reportKeySuccess,
  reportKeyFailure,
  classifyKeyError,
  type KeyProvider,
} from '../platform/providerKeys.js';

const router = Router();

type LicenseSnapshot = {
  valid: boolean;
  plan: string | null;
  expiresAt: string | null;
  features: string[];
  userId: number | null;
  requestsLimit: number | null;
  requestsUsed: number;
  adsEnabled: number;
  ownKeyPurchased: number;
};

const GEMINI_PROXY_MAX_RETRIES = 3;
const GEMINI_PROXY_RETRY_BASE_DELAY_MS = 2000;
const GEMINI_PROXY_RETRYABLE_PATTERN = /\b(429|500|502|503|504|unavailable|overloaded|resource_exhausted|too many requests|internal|deadline)\b/i;

type RetryableGeminiProxyError = Error & {
  retryAfterMs?: number;
};

// ── GET /api/client/license?device_id= ───────────────────────
// Main app gọi API này để kiểm tra trạng thái subscription
const getLicenseSnapshot = (deviceId: string): LicenseSnapshot => {
  if (!deviceId) {
    return { valid: false, plan: null, expiresAt: null, features: ['trial'], userId: null, requestsLimit: null, requestsUsed: 0, adsEnabled: 1, ownKeyPurchased: 0 };
  }
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE device_id = ?').get(deviceId) as { id: number } | undefined;

  if (!user) {
    return { valid: false, plan: null, expiresAt: null, features: ['trial'], userId: null, requestsLimit: null, requestsUsed: 0, adsEnabled: 1, ownKeyPurchased: 0 };
  }

  // Update last active
  db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?").run(user.id);

  const sub = db.prepare(
    "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(user.id) as { 
    plan: string; 
    expires_at: string | null; 
    requests_limit: number | null; 
    requests_used: number;
    ads_enabled: number;
    own_key_purchased: number;
  } | undefined;

  if (!sub) {
    return { valid: false, plan: null, expiresAt: null, features: ['trial'], userId: user.id, requestsLimit: null, requestsUsed: 0, adsEnabled: 1, ownKeyPurchased: 0 };
  }

  // Check expiration for monthly plans
  if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
    db.prepare("UPDATE subscriptions SET status = 'expired' WHERE user_id = ? AND status = 'active'").run(user.id);
    return { valid: false, plan: null, expiresAt: null, features: ['trial'], userId: user.id, requestsLimit: null, requestsUsed: 0, adsEnabled: 1, ownKeyPurchased: 0 };
  }

  const features = [
    'transcription',
    'meeting',
    'interview',
    'export',
    'workspace',
    'system_google_drive',
  ];

  const isSystemKeyPlan = sub.plan.startsWith('monthly_') || sub.plan === 'promo' || sub.plan === 'monthly';
  if (isSystemKeyPlan) {
    features.push('system_api_key');
  }

  const adsOff = sub.ads_enabled === 0 || isSystemKeyPlan || sub.plan === 'lifetime' || sub.plan === 'own_key_no_ads';
  if (adsOff) {
    features.push('disable_ads');
  }

  return {
    valid: true,
    plan: sub.plan,
    expiresAt: sub.expires_at,
    features,
    userId: user.id,
    requestsLimit: sub.requests_limit,
    requestsUsed: sub.requests_used,
    adsEnabled: adsOff ? 0 : 1,
    ownKeyPurchased: sub.own_key_purchased,
  };
};

// ── GET /api/client/license?device_id= ───────────────────────
// Main app gọi API này để kiểm tra trạng thái subscription
router.get('/license', async (req: Request, res: Response) => {
  const deviceId = req.query.device_id as string;
  if (!deviceId) {
    res.status(400).json({ valid: false, error: 'Thiếu device_id.' });
    return;
  }

  const snapshot = usePostgresBackend()
    ? await getLicenseSnapshotPostgres(deviceId)
    : getLicenseSnapshot(deviceId);

  res.json({
    valid: snapshot.valid,
    plan: snapshot.plan,
    expiresAt: snapshot.expiresAt,
    features: snapshot.features,
    requestsLimit: snapshot.requestsLimit,
    requestsUsed: snapshot.requestsUsed,
    adsEnabled: snapshot.adsEnabled,
    ownKeyPurchased: snapshot.ownKeyPurchased,
  });
});

// ── GET /api/client/runtime-config?device_id= ────────────────
// Trả về các cấu hình hệ thống được phép dùng theo entitlement của thiết bị.
router.get('/runtime-config', async (req: Request, res: Response) => {
  const deviceId = req.query.device_id as string;
  if (!deviceId) {
    res.status(400).json({ error: 'Thiếu device_id.' });
    return;
  }

  if (usePostgresBackend()) {
    res.json(await getRuntimeConfigPostgres(deviceId));
    return;
  }

  const snapshot = getLicenseSnapshot(deviceId);
  res.json({
    features: snapshot.features,
    googleClientId: getSystemConfig('system_google_client_id'),
    googleApiKey: getSystemConfig('system_google_api_key'),
    requestsLimit: snapshot.requestsLimit,
    requestsUsed: snapshot.requestsUsed,
    adsEnabled: snapshot.adsEnabled,
    ownKeyPurchased: snapshot.ownKeyPurchased,
    admobAppId: getSystemConfig('admob_app_id'),
    admobBannerId: getSystemConfig('admob_banner_id'),
    admobRewardedId: getSystemConfig('admob_rewarded_id'),
    customBannerHtml: getSystemConfig('custom_banner_html'),
    customBannerEnabled: getSystemConfig('custom_banner_enabled') === 'true',
  });
});

// ── POST /api/client/redeem ──────────────────────────────────
// User nhập promo code trong app
router.post('/redeem', async (req: Request, res: Response) => {
  const { deviceId, code } = req.body;

  if (!deviceId || !code) {
    res.status(400).json({ ok: false, error: 'Thiếu device_id hoặc mã code.' });
    return;
  }

  if (usePostgresBackend()) {
    try {
      const result = await redeemPromoCodePostgres(String(deviceId), String(code));
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể kích hoạt mã promo.';
      const status = message.includes('không tồn tại') ? 404 : 410;
      res.status(status).json({ ok: false, error: message });
    }
    return;
  }

  const db = getDb();
  const promo = db.prepare(
    'SELECT * FROM promo_codes WHERE code = ? AND is_active = 1'
  ).get(code.toUpperCase().trim()) as PromoCode | undefined;

  if (!promo) {
    res.status(404).json({ ok: false, error: 'Mã code không tồn tại hoặc đã hết hạn.' });
    return;
  }

  if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
    res.status(410).json({ ok: false, error: 'Mã code đã hết lượt sử dụng.' });
    return;
  }

  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    res.status(410).json({ ok: false, error: 'Mã code đã hết hạn.' });
    return;
  }

  // Find or create user
  let user = db.prepare('SELECT id FROM users WHERE device_id = ?').get(deviceId) as { id: number } | undefined;
  if (!user) {
    const result = db.prepare('INSERT INTO users (device_id) VALUES (?)').run(deviceId);
    user = { id: Number(result.lastInsertRowid) };
  }

  // Cancel existing active subs
  db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(user.id);

  const expiresAt = promo.plan === 'monthly' && promo.duration_months
    ? new Date(Date.now() + promo.duration_months * 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  db.prepare(`
    INSERT INTO subscriptions (user_id, plan, status, expires_at, promo_code_id)
    VALUES (?, 'promo', 'active', ?, ?)
  `).run(user.id, expiresAt, promo.id);

  // Increment used count
  db.prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?').run(promo.id);

  res.json({
    ok: true,
    plan: promo.plan,
    expiresAt,
    message: promo.plan === 'lifetime'
      ? 'Kích hoạt thành công gói trọn đời!'
      : `Kích hoạt thành công gói ${promo.duration_months || 1} tháng!`,
  });
});

// ── POST /api/client/usage ───────────────────────────────────
// Main app gửi log sử dụng
router.post('/usage', async (req: Request, res: Response) => {
  const { deviceId, action, provider, durationSeconds, fileSizeBytes } = req.body;

  if (!action) {
    res.status(400).json({ error: 'Thiếu action.' });
    return;
  }

  if (usePostgresBackend()) {
    await recordUsagePostgres(deviceId, action, provider, durationSeconds, fileSizeBytes);
    res.json({ ok: true });
    return;
  }

  const db = getDb();
  const user = deviceId
    ? db.prepare('SELECT id FROM users WHERE device_id = ?').get(deviceId) as { id: number } | undefined
    : undefined;

  db.prepare(`
    INSERT INTO usage_logs (user_id, device_id, action, provider, duration_seconds, file_size_bytes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user?.id || null, deviceId || null, action, provider || null, durationSeconds || null, fileSizeBytes || null);

  res.json({ ok: true });
});

// ── POST /api/client/ads/watched ──────────────────────────────
router.post('/ads/watched', async (req: Request, res: Response) => {
  const { deviceId } = req.body;
  if (!deviceId) {
    res.status(400).json({ error: 'Thiếu deviceId.' });
    return;
  }

  if (usePostgresBackend()) {
    await recordAdWatchedPostgres(deviceId);
    res.json({ ok: true, message: 'Xem quảng cáo thành công. Đã cộng 1 lượt dùng thử 5 phút.' });
    return;
  }

  const db = getDb();
  let user = db.prepare('SELECT id FROM users WHERE device_id = ?').get(deviceId) as { id: number } | undefined;
  if (!user) {
    const result = db.prepare('INSERT INTO users (device_id) VALUES (?)').run(deviceId);
    user = { id: Number(result.lastInsertRowid) };
  }

  db.prepare(`
    INSERT INTO ad_rewards (user_id, status)
    VALUES (?, 'pending')
  `).run(user.id);

  res.json({ ok: true, message: 'Xem quảng cáo thành công. Đã cộng 1 lượt dùng thử 5 phút.' });
});

export interface RequestAuthResult {
  status: 'paid' | 'free_ad';
  subscriptionId?: number;
  adRewardId?: number;
}

export const authorizeAndPrepareRequest = (
  db: any,
  deviceId: string,
  durationSeconds?: number,
  context?: string
): RequestAuthResult => {
  let user = db.prepare('SELECT id FROM users WHERE device_id = ?').get(deviceId) as { id: number } | undefined;
  if (!user) {
    const result = db.prepare('INSERT INTO users (device_id) VALUES (?)').run(deviceId);
    user = { id: Number(result.lastInsertRowid) };
  }

  const sub = db.prepare(
    "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(user.id) as {
    id: number;
    plan: string;
    requests_limit: number | null;
    requests_used: number;
    expires_at: string | null;
  } | undefined;

  if (sub) {
    if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
      db.prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?").run(sub.id);
    } else {
      if (sub.requests_limit !== null && sub.requests_used >= sub.requests_limit) {
        throw new Error('Gói dịch vụ của bạn đã dùng hết lượt. Vui lòng nâng cấp hoặc mua thêm lượt.');
      }
      return { status: 'paid', subscriptionId: sub.id };
    }
  }

  const pendingReward = db.prepare(
    "SELECT id FROM ad_rewards WHERE user_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1"
  ).get(user.id) as { id: number } | undefined;

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

export const completeRequestUsage = (
  db: any,
  auth: RequestAuthResult,
  durationSeconds?: number,
  isGeminiAnalysis: boolean = false
) => {
  if (auth.status === 'paid' && auth.subscriptionId) {
    if (isGeminiAnalysis) {
      db.prepare(`
        UPDATE subscriptions
        SET seconds_used = seconds_used + 1800,
            requests_used = requests_used + 1
        WHERE id = ?
      `).run(auth.subscriptionId);
    } else {
      const duration = Number(durationSeconds) || 300;
      db.prepare(`
        UPDATE subscriptions
        SET seconds_used = seconds_used + ?,
            requests_used = CAST((seconds_used + ?) / 1800 AS INTEGER)
        WHERE id = ?
      `).run(duration, duration, auth.subscriptionId);
    }
  } else if (auth.status === 'free_ad' && auth.adRewardId) {
    db.prepare(`
      UPDATE ad_rewards
      SET status = 'consumed', consumed_at = datetime('now')
      WHERE id = ?
    `).run(auth.adRewardId);
  }
};



// Helper to get system config value
const getSystemConfig = (key: string): string => {
  if (usePostgresBackend()) {
    return getPlatformSystemConfig(key);
  }
  const db = getDb();
  const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value || '';
};

// ── Pool nhiều key + xoay vòng / failover ─────────────────────
// Mỗi provider có thể có nhiều key (Postgres). Khi gọi upstream, lần lượt thử
// từng key; key lỗi do quota/auth bị đánh dấu cooldown/disabled và thử key kế.
// Key ENV cũ (system_config) luôn được thêm làm fallback cuối để không gãy khi
// pool trống.
type ResolvedKey = { id: string | null; value: string };

const resolveProviderKeys = async (
  provider: KeyProvider,
  envConfigKey: string
): Promise<ResolvedKey[]> => {
  const out: ResolvedKey[] = [];
  if (usePostgresBackend()) {
    try {
      for (const k of await getKeyCandidates(provider)) {
        out.push({ id: k.id, value: k.keyValue });
      }
    } catch {
      // Pool lỗi (vd bảng chưa tạo) -> dùng env fallback bên dưới.
    }
  }
  const envKey = getSystemConfig(envConfigKey);
  if (envKey && !out.some((k) => k.value === envKey)) {
    out.push({ id: null, value: envKey });
  }
  return out;
};

type KeyAttemptResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; keyError?: boolean };

// Lần lượt thử các key cho tới khi thành công.
// attempt trả keyError:false để báo "lỗi này KHÔNG do key" (dừng, không failover).
const runKeyFailover = async <T>(
  keys: ResolvedKey[],
  attempt: (key: string) => Promise<KeyAttemptResult<T>>
): Promise<KeyAttemptResult<T>> => {
  if (keys.length === 0) {
    return { ok: false, status: 500, error: 'Key hệ thống chưa được cấu hình.' };
  }
  let last: KeyAttemptResult<T> = { ok: false, status: 500, error: 'Tất cả key đều lỗi.' };
  for (const k of keys) {
    let r: KeyAttemptResult<T>;
    try {
      r = await attempt(k.value);
    } catch (err: any) {
      r = { ok: false, status: 500, error: err?.message || 'Lỗi gọi upstream.' };
    }
    if (r.ok) {
      if (k.id) await reportKeySuccess(k.id).catch(() => {});
      return r;
    }
    last = r;
    if (r.keyError === false) return r; // lỗi thật sự, không phải do key
    const cls = k.id ? classifyKeyError(r.status, r.error) : null;
    if (k.id && cls) {
      await reportKeyFailure(k.id, { ...cls, error: r.error }).catch(() => {});
      continue; // thử key kế tiếp
    }
    // Key ENV (id null) hoặc lỗi không phải do key -> dừng, trả lỗi thật.
    return r;
  }
  return last;
};

const authorizeProxyRequest = async (
  deviceId: string,
  durationSeconds?: number,
  context?: string
): Promise<RequestAuthResult | PostgresAuthResult> => {
  if (usePostgresBackend()) {
    return authorizeAndPrepareRequestPostgres(deviceId, durationSeconds, context);
  }
  return authorizeAndPrepareRequest(getDb(), deviceId, durationSeconds, context);
};

const completeProxyUsage = async (
  auth: RequestAuthResult | PostgresAuthResult,
  durationSeconds?: number,
  isGeminiAnalysis = false
) => {
  if (usePostgresBackend()) {
    await completeRequestUsagePostgres(auth as PostgresAuthResult, durationSeconds, isGeminiAnalysis);
    return;
  }
  completeRequestUsage(getDb(), auth as RequestAuthResult, durationSeconds, isGeminiAnalysis);
};

const sanitizeJsonText = (value: string) =>
  value
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const normalizeGenerationConfigForRest = (generationConfig: Record<string, any> | undefined) => {
  if (!generationConfig) return undefined;
  const { responseJsonSchema, ...rest } = generationConfig;
  return responseJsonSchema
    ? {
        ...rest,
        responseSchema: responseJsonSchema,
      }
    : rest;
};

const extractGeminiCandidateText = (responseBody: any) =>
  responseBody?.candidates?.[0]?.content?.parts
    ?.map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim() || '';

const extractTranscriptFromModelText = (rawText: string) => {
  const cleaned = sanitizeJsonText(rawText);
  if (!cleaned) return '';

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const transcript = typeof parsed.transcript === 'string' ? parsed.transcript.trim() : '';
    if (transcript) return transcript;
  } catch {
    // Plain-text output is expected for Gemini STT.
  }

  return cleaned;
};

const isRetryableGeminiProxyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return GEMINI_PROXY_RETRYABLE_PATTERN.test(message);
};

const getGeminiProxyRetryDelayMs = (error: unknown, attempt: number) => {
  const retryAfterMs =
    error instanceof Error
      ? (error as RetryableGeminiProxyError).retryAfterMs
      : undefined;
  if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(retryAfterMs, 120000);
  }
  return GEMINI_PROXY_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
};

const retryGeminiProxyRequest = async <T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= GEMINI_PROXY_MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= GEMINI_PROXY_MAX_RETRIES || !isRetryableGeminiProxyError(error)) {
        throw error;
      }

      const delayMs = getGeminiProxyRetryDelayMs(error, attempt);
      console.warn(`${context}: retry ${attempt + 1}/${GEMINI_PROXY_MAX_RETRIES} after ${delayMs}ms`, error);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};

const parseGeminiProxyRetryDelayMs = (response: globalThis.Response, bodyText: string) => {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const asSeconds = Number(retryAfter);
    if (Number.isFinite(asSeconds) && asSeconds > 0) {
      return asSeconds * 1000;
    }

    const asDate = Date.parse(retryAfter);
    if (Number.isFinite(asDate)) {
      return Math.max(0, asDate - Date.now());
    }
  }

  const retryDelayMatch = bodyText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (retryDelayMatch) {
    return Number(retryDelayMatch[1]) * 1000;
  }

  return undefined;
};

const fetchGeminiProxyResponse = async (
  input: string,
  init: RequestInit,
  context: string
) =>
  retryGeminiProxyRequest(async () => {
    const response = await fetch(input, init);
    if (
      !response.ok &&
      GEMINI_PROXY_RETRYABLE_PATTERN.test(
        `${response.status} ${response.statusText || ''}`
      )
    ) {
      const bodyText = await response.text();
      const error = new Error(
        `Gemini proxy upstream error (${response.status}): ${bodyText}`
      ) as RetryableGeminiProxyError;
      error.retryAfterMs = parseGeminiProxyRetryDelayMs(response, bodyText);
      throw error;
    }
    return response;
  }, context);

const buildGeminiTranscriptionModelCandidates = (preferredModelId?: string) =>
  Array.from(
    new Set(
      [
        'gemini-2.5-flash-lite',
        preferredModelId,
        'gemini-2.5-flash',
      ].filter((modelId): modelId is string => Boolean(modelId && modelId.trim()))
    )
  );

// Helper to upload a buffer to Gemini Files API via REST
const uploadToGeminiFiles = async (
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  geminiApiKey: string
): Promise<string> => {
  // 1. Start resumable upload
  const initRes = await fetchGeminiProxyResponse(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': buffer.length.toString(),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: {
          displayName: fileName || 'audio_chunk.wav',
        },
      }),
    },
    'uploadToGeminiFiles:init'
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Failed to initiate Gemini file upload: ${errText}`);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url') || initRes.headers.get('X-Goog-Upload-Url');
  if (!uploadUrl) {
    throw new Error('Did not receive upload URL from Gemini API.');
  }

  // 2. Upload file contents
  const uploadRes = await fetchGeminiProxyResponse(
    uploadUrl,
    {
      method: 'POST',
      headers: {
        'Content-Length': buffer.length.toString(),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: buffer,
    },
    'uploadToGeminiFiles:finalize'
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload file bytes to Gemini: ${errText}`);
  }

  const fileMetadata = (await uploadRes.json()) as any;
  const fileUri = fileMetadata.file?.uri;
  const fileNameOnServer = fileMetadata.file?.name; // files/abc123xyz

  if (!fileUri || !fileNameOnServer) {
    throw new Error('Upload succeeded but metadata is missing server name or URI.');
  }

  // 3. Poll for state to become ACTIVE
  let state = fileMetadata.file?.state;
  while (state === 'PROCESSING') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pollRes = await fetchGeminiProxyResponse(
      `https://generativelanguage.googleapis.com/v1beta/${fileNameOnServer}?key=${geminiApiKey}`,
      {},
      'uploadToGeminiFiles:poll'
    );
    if (!pollRes.ok) {
      throw new Error(`Failed to poll file status: ${await pollRes.text()}`);
    }
    const pollData = (await pollRes.json()) as any;
    state = pollData.state;
    if (state === 'FAILED') {
      throw new Error('Gemini File processing state failed.');
    }
  }

  return fileUri;
};

// ── POST /api/client/proxy/gemini ─────────────────────────────
// Proxy cho các cuộc gọi Gemini (ví dụ: phân tích văn bản)
router.post('/proxy/gemini', async (req: Request, res: Response) => {
  const { deviceId, model, contents, generationConfig } = req.body;

  if (!deviceId) {
    res.status(400).json({ error: 'Thiếu deviceId.' });
    return;
  }

  let auth: RequestAuthResult | PostgresAuthResult;
  try {
    auth = await authorizeProxyRequest(deviceId, undefined, undefined);
  } catch (err: any) {
    res.status(402).json({ error: err.message });
    return;
  }

  const geminiKeys = await resolveProviderKeys('gemini', 'admin_gemini_api_key');
  if (geminiKeys.length === 0) {
    res.status(500).json({ error: 'Key hệ thống Gemini chưa được cấu hình.' });
    return;
  }

  try {
    const result = await runKeyFailover<string>(geminiKeys, async (apiKey) => {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetchGeminiProxyResponse(
        geminiUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: normalizeGenerationConfigForRest(generationConfig),
          })
        },
        `proxy/gemini:${model}`
      );

      if (!response.ok) {
        return { ok: false, status: response.status, error: await response.text() };
      }

      const data = await response.json();
      const rawText = extractGeminiCandidateText(data);
      if (!rawText) {
        return { ok: false, status: 502, error: 'Gemini API không trả về nội dung hợp lệ.', keyError: false };
      }
      return { ok: true, value: rawText };
    });

    if (!result.ok) {
      res.status(result.status).json({ error: sanitizeUpstreamError(result.status, result.error) });
      return;
    }

    try {
      const parsed = JSON.parse(sanitizeJsonText(result.value));
      await completeProxyUsage(auth, undefined, true);
      res.json(parsed);
    } catch {
      res.status(502).json({ error: `Gemini API trả về JSON không hợp lệ: ${result.value}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi gọi proxy Gemini.' });
  }
});

// ── POST /api/client/proxy/transcribe ─────────────────────────
// Proxy cho các cuộc gọi nhận diện giọng nói (Gemini, Groq, OpenAI, AssemblyAI)
router.post('/proxy/transcribe', async (req: Request, res: Response) => {
  const {
    deviceId,
    provider,
    fileBase64,
    uploadSessionId,
    fileName: bodyFileName,
    fileType: bodyFileType,
    mode,
    language,
    preferredModelId,
    durationSeconds,
    context,
  } = req.body;
  const normalizedMode = typeof mode === 'string' ? mode.toUpperCase() : 'TIMELINE';

  if (!deviceId || !provider || (!fileBase64 && !uploadSessionId)) {
    res.status(400).json({ error: 'Thiếu deviceId, provider và fileBase64 hoặc uploadSessionId.' });
    return;
  }

  let auth: RequestAuthResult | PostgresAuthResult;
  try {
    auth = await authorizeProxyRequest(deviceId, durationSeconds, context);
  } catch (err: any) {
    res.status(402).json({ error: err.message });
    return;
  }

  try {
    let buffer: Buffer;
    let fileName = typeof bodyFileName === 'string' ? bodyFileName : 'audio.wav';
    let fileType = typeof bodyFileType === 'string' ? bodyFileType : 'audio/wav';

    if (uploadSessionId) {
      if (!usePostgresBackend()) {
        res.status(400).json({ error: 'uploadSessionId chỉ hỗ trợ trên backend PostgreSQL.' });
        return;
      }
      const session = await consumeUploadSession(String(uploadSessionId), String(deviceId));
      buffer = session.buffer;
      fileName = session.fileName;
      fileType = session.mimeType;
    } else {
      buffer = Buffer.from(fileBase64, 'base64');
    }

    if (provider === 'gemini') {
      const geminiKeys = await resolveProviderKeys('gemini', 'admin_gemini_api_key');
      if (geminiKeys.length === 0) {
        res.status(500).json({ error: 'Key hệ thống Gemini chưa được cấu hình.' });
        return;
      }

      const prompt = `Vai tro: cong cu speech-to-text.
Nhiem vu:
- Chi nghe audio/video va tra ve transcript thuan.
- Khong tom tat.
- Khong suy dien.
- Khong tao decisions, risks, mindmap hay artifact nao khac.
- Neu khong nghe ro, giu dung phan nghe duoc; khong tu bia.
- Giu nguyen ngon ngu noi goc trong file, khong dich sang ngon ngu UI.

${normalizedMode === 'TIMELINE' ? 'Transcript phai dung dang tung dong:\n[HH:MM:SS] Noi dung' : 'Transcript phai o dang van ban lien mach, khong co timestamp.'}

Rang buoc:
- Chi tra ve transcript text, khong JSON, khong markdown fence, khong giai thich them.`;

      const candidateModels = buildGeminiTranscriptionModelCandidates(
        typeof preferredModelId === 'string' ? preferredModelId : undefined
      );
      const isLargeFile = buffer.length > 8 * 1024 * 1024;

      // Mỗi key thử lần lượt các model. File >8MB phải upload bằng CHÍNH key đó
      // (Gemini Files gắn với key/project) nên upload nằm trong attempt theo key.
      const result = await runKeyFailover<{ transcript: string; modelId: string }>(
        geminiKeys,
        async (apiKey) => {
          let filePart: any;
          if (isLargeFile) {
            const fileUri = await uploadToGeminiFiles(
              buffer,
              fileType || 'audio/wav',
              fileName || 'audio.wav',
              apiKey
            );
            filePart = { fileData: { fileUri, mimeType: fileType || 'audio/wav' } };
          } else {
            filePart = { inlineData: { data: fileBase64, mimeType: fileType || 'audio/wav' } };
          }

          let lastStatus = 500;
          let lastError = 'Gemini STT request failed.';
          for (const modelId of candidateModels) {
            const response = await fetchGeminiProxyResponse(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [filePart, { text: prompt }] }],
                  generationConfig: { temperature: 0.1 },
                })
              },
              `proxy/transcribe:${modelId}`
            );

            if (!response.ok) {
              lastStatus = response.status;
              lastError = `Gemini STT error (${modelId}): ${await response.text()}`;
              continue;
            }

            const data = await response.json();
            const transcript = extractTranscriptFromModelText(extractGeminiCandidateText(data));
            if (transcript.trim()) {
              return { ok: true, value: { transcript, modelId } };
            }
            lastStatus = 502;
            lastError = `Gemini STT returned empty transcript (${modelId}).`;
          }
          return { ok: false, status: lastStatus, error: lastError };
        }
      );

      if (!result.ok) {
        res.status(result.status).json({ error: sanitizeUpstreamError(result.status, result.error) });
        return;
      }
      await completeProxyUsage(auth, durationSeconds, false);
      res.json({ transcript: result.value.transcript, modelId: result.value.modelId });
      return;
    }

    if (provider === 'groq' || provider === 'openai') {
      const configKey = provider === 'groq' ? 'admin_groq_api_key' : 'admin_openai_api_key';
      const sttKeys = await resolveProviderKeys(provider as KeyProvider, configKey);
      if (sttKeys.length === 0) {
        res.status(500).json({ error: `Key hệ thống ${provider} chưa được cấu hình.` });
        return;
      }

      const url = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/audio/transcriptions'
        : 'https://api.openai.com/v1/audio/transcriptions';

      const result = await runKeyFailover<any>(sttKeys, async (apiKey) => {
        // Dựng lại FormData mỗi lần thử (body stream chỉ đọc được 1 lần).
        const blob = new Blob([buffer], { type: fileType || 'audio/wav' });
        const formData = new FormData();
        formData.append('file', blob, fileName || 'audio.wav');
        formData.append('model', provider === 'groq' ? 'whisper-large-v3-turbo' : 'whisper-1');
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities[]', 'segment');
        if (typeof language === 'string' && language.trim()) {
          formData.append('language', language.trim());
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData
        });

        if (!response.ok) {
          return { ok: false, status: response.status, error: await response.text() };
        }
        return { ok: true, value: await response.json() };
      });

      if (!result.ok) {
        res.status(result.status).json({ error: sanitizeUpstreamError(result.status, `${provider} STT: ${result.error}`) });
        return;
      }

      const data = result.value;
      let transcript = '';
      if (data.segments && data.segments.length > 0) {
        if (normalizedMode === 'PLAIN') {
          transcript = data.segments.map((seg: any) => seg.text.trim()).filter(Boolean).join(' ');
        } else {
          transcript = data.segments.map((seg: any) => {
            const totalSecs = Math.floor(seg.start);
            const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
            const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
            const s = (totalSecs % 60).toString().padStart(2, '0');
            return `[${h}:${m}:${s}] ${seg.text.trim()}`;
          }).join('\n');
        }
      } else {
        transcript = data.text || '';
      }

      await completeProxyUsage(auth, durationSeconds, false);
      res.json({ transcript });
      return;
    }

    if (provider === 'assemblyai') {
      const aaiKeys = await resolveProviderKeys('assemblyai', 'admin_assemblyai_api_key');
      if (aaiKeys.length === 0) {
        res.status(500).json({ error: 'Key hệ thống AssemblyAI chưa được cấu hình.' });
        return;
      }

      // Upload + submit phải dùng cùng 1 key; failover qua pool nếu key lỗi.
      const submit = await runKeyFailover<{ transcriptId: string; status: string; apiKey: string }>(
        aaiKeys,
        async (apiKey) => {
          const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: { authorization: apiKey, 'content-type': 'application/octet-stream' },
            body: buffer
          });
          if (!uploadRes.ok) {
            return { ok: false, status: uploadRes.status, error: `upload: ${await uploadRes.text()}` };
          }
          const uploadData = await uploadRes.json();

          const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: { authorization: apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
              audio_url: uploadData.upload_url,
              language_detection: true,
              speaker_labels: true
            })
          });
          if (!submitRes.ok) {
            return { ok: false, status: submitRes.status, error: `submit: ${await submitRes.text()}` };
          }
          const submitData = await submitRes.json();
          return { ok: true, value: { transcriptId: submitData.id, status: submitData.status, apiKey } };
        }
      );

      if (!submit.ok) {
        res.status(submit.status).json({ error: sanitizeUpstreamError(submit.status, `AssemblyAI: ${submit.error}`) });
        return;
      }

      const transcriptId = submit.value.transcriptId;
      const aaiKey = submit.value.apiKey;
      const submitData = { status: submit.value.status };

      // Poll until done
      let status = submitData.status;
      let transcriptText = '';
      const startTime = Date.now();
      const maxTimeMs = 30 * 60 * 1000; // 30 mins

      while (status === 'queued' || status === 'processing') {
        if (Date.now() - startTime > maxTimeMs) {
          res.status(504).json({ error: 'AssemblyAI proxy timeout' });
          return;
        }
        await new Promise(r => setTimeout(r, 4000));
        
        const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: { authorization: aaiKey }
        });
        
        if (!pollRes.ok) {
          res.status(pollRes.status).json({ error: 'AssemblyAI polling error' });
          return;
        }

        const pollData = await pollRes.json();
        status = pollData.status;

        if (status === 'completed') {
          if (pollData.utterances && pollData.utterances.length > 0) {
            transcriptText = pollData.utterances
              .map((u: any) => `[Speaker ${u.speaker}] ${u.text}`)
              .join('\n\n');
          } else {
            transcriptText = pollData.text || '';
          }
          await completeProxyUsage(auth, durationSeconds, false);
          res.json({ transcript: transcriptText });
          return;
        } else if (status === 'error') {
          res.status(500).json({ error: `AssemblyAI processing error: ${pollData.error}` });
          return;
        }
      }

      res.json({ transcript: transcriptText });
      return;
    }

    res.status(400).json({ error: `Nhà cung cấp không hợp lệ: ${provider}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi xử lý proxy transcription.' });
  }
});

// ── GET /api/client/payment-info ──────────────────────────────
router.get('/payment-info', async (_req: Request, res: Response) => {
  if (usePostgresBackend()) {
    res.json(await getPaymentInfoPostgres());
    return;
  }

  res.json({
    sepayEnabled: getSystemConfig('sepay_enabled') === 'true',
    bankName: getSystemConfig('sepay_bank_name'),
    accountNumber: getSystemConfig('sepay_bank_account'),
    accountName: getSystemConfig('sepay_account_name'),
    stripeEnabled: getSystemConfig('stripe_enabled') === 'true',
    pricing: {
      monthly_20: parseInt(getSystemConfig('monthly_20_price') || '39000', 10),
      monthly_50: parseInt(getSystemConfig('monthly_50_price') || '59000', 10),
      monthly_100: parseInt(getSystemConfig('monthly_100_price') || '99000', 10),
      own_key_ads: parseInt(getSystemConfig('own_key_ads_price') || '199000', 10),
      own_key_no_ads: parseInt(getSystemConfig('own_key_no_ads_price') || '248000', 10),
      disable_ads: parseInt(getSystemConfig('disable_ads_price') || '49000', 10),
    },
    discounts: {
      '3M': parseInt(getSystemConfig('discount_3m') || '3', 10),
      '6M': parseInt(getSystemConfig('discount_6m') || '5', 10),
      '12M': parseInt(getSystemConfig('discount_12m') || '8', 10),
    }
  });
});

// ── POST /api/client/payments/create-stripe-session ───────────
router.post('/payments/create-stripe-session', async (req: Request, res: Response) => {
  const { deviceId, plan, durationMonths } = req.body;
  if (!deviceId || !plan) {
    res.status(400).json({ error: 'Thiếu deviceId hoặc plan.' });
    return;
  }

  const secretKey = getSystemConfig('stripe_secret_key');
  if (!secretKey) {
    res.status(500).json({ error: 'Thanh toán Stripe chưa được cấu hình.' });
    return;
  }

  const stripe = new Stripe(secretKey);

  // Calculate price based on plan and duration
  const duration = Number(durationMonths) || 1;
  const priceKey = `${plan}_price`;
  let basePrice = parseInt(getSystemConfig(priceKey), 10);
  if (isNaN(basePrice)) {
    if (plan === 'monthly') basePrice = parseInt(getSystemConfig('monthly_price'), 10);
    else if (plan === 'lifetime') basePrice = parseInt(getSystemConfig('lifetime_price'), 10);
    else basePrice = 0;
  }

  let expectedPrice = basePrice * duration;
  if (duration === 3) {
    const discount = parseInt(getSystemConfig('discount_3m') || '3', 10);
    expectedPrice = Math.round(expectedPrice * (1 - discount / 100));
  } else if (duration === 6) {
    const discount = parseInt(getSystemConfig('discount_6m') || '5', 10);
    expectedPrice = Math.round(expectedPrice * (1 - discount / 100));
  } else if (duration === 12) {
    const discount = parseInt(getSystemConfig('discount_12m') || '8', 10);
    expectedPrice = Math.round(expectedPrice * (1 - discount / 100));
  }

  // Convert VND to USD rate (e.g. 25000 VND = 1 USD)
  const usdAmountCents = Math.round((expectedPrice / 25000) * 100);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `TSrecord - ${plan.toUpperCase()} (${duration}M)`,
              description: `Thiết bị: ${deviceId}`,
            },
            unit_amount: usdAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin || 'http://localhost:3000'}/?payment=success`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/?payment=cancel`,
      metadata: {
        deviceId,
        plan,
        durationMonths: String(duration),
      },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Stripe] Error creating checkout session:', err);
    res.status(500).json({ error: err.message || 'Lỗi khởi tạo Stripe session.' });
  }
});

export default router;
