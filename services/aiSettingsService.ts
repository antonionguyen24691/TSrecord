import { getSecureValue, removeSecureValue, setSecureValue } from './secureStorage';
import { isWebDemo } from './platformMode';

// --- Storage Keys ---
const API_KEY_KEY = 'gemini_api_key';
const MODEL_ID_KEY = 'gemini_model_id';
const REALTIME_MODEL_ID_KEY = 'gemini_realtime_model_id';
const ANALYSIS_MODEL_ID_KEY = 'gemini_analysis_model_id';
const REALTIME_MODE_KEY = 'gemini_realtime_mode';
const TRANSCRIPTION_PROVIDER_KEY = 'transcription_provider';
const ASSEMBLYAI_API_KEY_KEY = 'assemblyai_api_key';
const GROQ_API_KEY_KEY = 'groq_api_key';
const OPENAI_API_KEY_KEY = 'openai_api_key';
const RECORDING_PROFILE_KEY = 'recording_profile';
const NOISE_SUPPRESSION_LEVEL_KEY = 'noise_suppression_level';
const ECHO_CANCELLATION_LEVEL_KEY = 'echo_cancellation_level';
const AUTO_GAIN_LEVEL_KEY = 'auto_gain_level';
const PREFERRED_SAMPLE_RATE_KEY = 'preferred_sample_rate';
const PREFERRED_CHANNEL_COUNT_KEY = 'preferred_channel_count';
const CHUNK_DURATION_MINUTES_KEY = 'chunk_duration_minutes';
const MACRO_BATCH_MINUTES_KEY = 'macro_batch_minutes';
const CHUNK_STAGGER_SECONDS_KEY = 'chunk_stagger_seconds';
const CHUNK_CONCURRENCY_KEY = 'chunk_concurrency';
const USE_ADMIN_KEY_KEY = 'use_admin_key';
const GOOGLE_CLIENT_ID_KEY = 'google_client_id';
const GOOGLE_API_KEY_KEY = 'google_api_key';

// --- Defaults ---
export const DEFAULT_MODEL_ID = 'gemini-2.5-flash';
export const DEFAULT_REALTIME_MODEL_ID = 'gemini-2.5-flash-lite';
export const DEFAULT_ANALYSIS_MODEL_ID = 'gemini-2.5-flash';
export const AVAILABLE_GEMINI_MODEL_IDS = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
] as const;
export type RealtimeMode = 'FULL' | 'HYBRID' | 'OFF';
export const DEFAULT_REALTIME_MODE: RealtimeMode = 'HYBRID';
export type TranscriptionProvider = 'gemini' | 'assemblyai' | 'groq' | 'openai';
export const DEFAULT_TRANSCRIPTION_PROVIDER: TranscriptionProvider = 'gemini';
export type RecordingProfile = 'BALANCED' | 'VOICE_FOCUS' | 'NOISY_ENV' | 'RAW' | 'CUSTOM';
export type ProcessingStrength = 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';
export type PreferredSampleRate = 16000 | 24000 | 44100 | 48000;
export type PreferredChannelCount = 1 | 2;
export const DEFAULT_RECORDING_PROFILE: RecordingProfile = 'BALANCED';
export const DEFAULT_NOISE_SUPPRESSION_LEVEL: ProcessingStrength = 'MEDIUM';
export const DEFAULT_ECHO_CANCELLATION_LEVEL: ProcessingStrength = 'MEDIUM';
export const DEFAULT_AUTO_GAIN_LEVEL: ProcessingStrength = 'LOW';
export const DEFAULT_PREFERRED_SAMPLE_RATE: PreferredSampleRate = 48000;
export const DEFAULT_PREFERRED_CHANNEL_COUNT: PreferredChannelCount = 1;
export const DEFAULT_CHUNK_DURATION_MINUTES = 8;
export const DEFAULT_MACRO_BATCH_MINUTES = 20;
export const DEFAULT_CHUNK_STAGGER_SECONDS = 2;
export const DEFAULT_CHUNK_CONCURRENCY = 1;
export const DEFAULT_USE_ADMIN_KEY = false;

// --- Interfaces ---
export interface AiSettings {
  // Gemini
  apiKey: string;
  realtimeModelId: string;
  analysisModelId: string;
  realtimeMode: RealtimeMode;
  // Multi-Provider
  transcriptionProvider: TranscriptionProvider;
  assemblyaiApiKey: string;
  groqApiKey: string;
  openaiApiKey: string;
  recordingProfile: RecordingProfile;
  noiseSuppressionLevel: ProcessingStrength;
  echoCancellationLevel: ProcessingStrength;
  autoGainLevel: ProcessingStrength;
  preferredSampleRate: PreferredSampleRate;
  preferredChannelCount: PreferredChannelCount;
  chunkDurationMinutes: number;
  macroBatchMinutes: number;
  chunkStaggerSeconds: number;
  chunkConcurrency: number;
  useAdminKey: boolean;
  googleClientId: string;
  googleApiKey: string;
}

const VALID_PROCESSING_STRENGTHS: ProcessingStrength[] = ['OFF', 'LOW', 'MEDIUM', 'HIGH'];
const VALID_RECORDING_PROFILES: RecordingProfile[] = [
  'BALANCED',
  'VOICE_FOCUS',
  'NOISY_ENV',
  'RAW',
  'CUSTOM',
];
const VALID_SAMPLE_RATES: PreferredSampleRate[] = [16000, 24000, 44100, 48000];
const VALID_CHANNEL_COUNTS: PreferredChannelCount[] = [1, 2];

// --- Storage Helpers ---
const getStoredValue = async (key: string) => (await getSecureValue(key)) || '';

const setStoredValue = async (key: string, value: string) => {
  await setSecureValue(key, value);
};

const removeStoredValue = async (key: string) => {
  await removeSecureValue(key);
};

// --- In-memory cache ---
let _cachedSettings: AiSettings | null = null;

export const invalidateSettingsCache = () => {
  _cachedSettings = null;
};

// --- Public API ---
export const loadAiSettings = async (): Promise<AiSettings> => {
  if (_cachedSettings) return _cachedSettings;
  const [
    apiKeyResult,
    legacyModelIdResult,
    realtimeModelIdResult,
    analysisModelIdResult,
    realtimeModeResult,
    transcriptionProviderResult,
    assemblyaiApiKeyResult,
    groqApiKeyResult,
    openaiApiKeyResult,
    recordingProfileResult,
    noiseSuppressionLevelResult,
    echoCancellationLevelResult,
    autoGainLevelResult,
    preferredSampleRateResult,
    preferredChannelCountResult,
    chunkDurationMinutesResult,
    macroBatchMinutesResult,
    chunkStaggerSecondsResult,
    _chunkConcurrencyResult,
    useAdminKeyResult,
    googleClientIdResult,
    googleApiKeyResult,
  ] = await Promise.all([
    getStoredValue(API_KEY_KEY),
    getStoredValue(MODEL_ID_KEY),
    getStoredValue(REALTIME_MODEL_ID_KEY),
    getStoredValue(ANALYSIS_MODEL_ID_KEY),
    getStoredValue(REALTIME_MODE_KEY),
    getStoredValue(TRANSCRIPTION_PROVIDER_KEY),
    getStoredValue(ASSEMBLYAI_API_KEY_KEY),
    getStoredValue(GROQ_API_KEY_KEY),
    getStoredValue(OPENAI_API_KEY_KEY),
    getStoredValue(RECORDING_PROFILE_KEY),
    getStoredValue(NOISE_SUPPRESSION_LEVEL_KEY),
    getStoredValue(ECHO_CANCELLATION_LEVEL_KEY),
    getStoredValue(AUTO_GAIN_LEVEL_KEY),
    getStoredValue(PREFERRED_SAMPLE_RATE_KEY),
    getStoredValue(PREFERRED_CHANNEL_COUNT_KEY),
    getStoredValue(CHUNK_DURATION_MINUTES_KEY),
    getStoredValue(MACRO_BATCH_MINUTES_KEY),
    getStoredValue(CHUNK_STAGGER_SECONDS_KEY),
    getStoredValue(CHUNK_CONCURRENCY_KEY),
    getStoredValue(USE_ADMIN_KEY_KEY),
    getStoredValue(GOOGLE_CLIENT_ID_KEY),
    getStoredValue(GOOGLE_API_KEY_KEY),
  ]);

  const fallbackModel = legacyModelIdResult || DEFAULT_MODEL_ID;
  const validProviders: TranscriptionProvider[] = ['gemini', 'assemblyai', 'groq', 'openai'];
  const provider = validProviders.includes(transcriptionProviderResult as TranscriptionProvider)
    ? (transcriptionProviderResult as TranscriptionProvider)
    : DEFAULT_TRANSCRIPTION_PROVIDER;

  const sanitizeModelId = (id: string, defaultId: string) => {
    const cleanId = id || fallbackModel || defaultId;
    // Map previous or user-tampered versions to the correct API ID
    if (cleanId === 'gemini-3.1-flash-lite' || cleanId === 'gemini 3.1 flash lite') {
      return 'gemini-3.1-flash-lite-preview';
    }
    if (cleanId === 'gemini-3-flash' || cleanId === 'gemini 3 flash') {
      return 'gemini-3-flash-preview';
    }
    if (cleanId === 'gemini-3-pro' || cleanId === 'gemini 3 pro') {
      return 'gemini-3-pro-preview';
    }
    if (!AVAILABLE_GEMINI_MODEL_IDS.includes(cleanId as (typeof AVAILABLE_GEMINI_MODEL_IDS)[number])) {
      return defaultId;
    }
    return cleanId;
  };

  const sampleRate = Number(preferredSampleRateResult);
  const channelCount = Number(preferredChannelCountResult);
  const chunkDurationMinutes = Number(chunkDurationMinutesResult);
  const macroBatchMinutes = Number(macroBatchMinutesResult);
  const chunkStaggerSeconds = Number(chunkStaggerSecondsResult);

  const settings: AiSettings = {
    apiKey: apiKeyResult,
    realtimeModelId: sanitizeModelId(realtimeModelIdResult, DEFAULT_REALTIME_MODEL_ID),
    analysisModelId: sanitizeModelId(analysisModelIdResult, DEFAULT_ANALYSIS_MODEL_ID),
    realtimeMode:
      realtimeModeResult === 'FULL' || realtimeModeResult === 'HYBRID' || realtimeModeResult === 'OFF'
        ? (realtimeModeResult as RealtimeMode)
        : DEFAULT_REALTIME_MODE,
    transcriptionProvider: provider,
    assemblyaiApiKey: assemblyaiApiKeyResult,
    groqApiKey: groqApiKeyResult,
    openaiApiKey: openaiApiKeyResult,
    recordingProfile: VALID_RECORDING_PROFILES.includes(recordingProfileResult as RecordingProfile)
      ? (recordingProfileResult as RecordingProfile)
      : DEFAULT_RECORDING_PROFILE,
    noiseSuppressionLevel: VALID_PROCESSING_STRENGTHS.includes(
      noiseSuppressionLevelResult as ProcessingStrength
    )
      ? (noiseSuppressionLevelResult as ProcessingStrength)
      : DEFAULT_NOISE_SUPPRESSION_LEVEL,
    echoCancellationLevel: VALID_PROCESSING_STRENGTHS.includes(
      echoCancellationLevelResult as ProcessingStrength
    )
      ? (echoCancellationLevelResult as ProcessingStrength)
      : DEFAULT_ECHO_CANCELLATION_LEVEL,
    autoGainLevel: VALID_PROCESSING_STRENGTHS.includes(autoGainLevelResult as ProcessingStrength)
      ? (autoGainLevelResult as ProcessingStrength)
      : DEFAULT_AUTO_GAIN_LEVEL,
    preferredSampleRate: VALID_SAMPLE_RATES.includes(sampleRate as PreferredSampleRate)
      ? (sampleRate as PreferredSampleRate)
      : DEFAULT_PREFERRED_SAMPLE_RATE,
    preferredChannelCount: VALID_CHANNEL_COUNTS.includes(channelCount as PreferredChannelCount)
      ? (channelCount as PreferredChannelCount)
      : DEFAULT_PREFERRED_CHANNEL_COUNT,
    chunkDurationMinutes:
      Number.isFinite(chunkDurationMinutes) && chunkDurationMinutes >= 1 && chunkDurationMinutes <= 30
        ? Math.round(chunkDurationMinutes)
        : DEFAULT_CHUNK_DURATION_MINUTES,
    macroBatchMinutes:
      Number.isFinite(macroBatchMinutes) && macroBatchMinutes >= 5 && macroBatchMinutes <= 30
        ? Math.round(macroBatchMinutes)
        : DEFAULT_MACRO_BATCH_MINUTES,
    chunkStaggerSeconds:
      Number.isFinite(chunkStaggerSeconds) && chunkStaggerSeconds >= 0 && chunkStaggerSeconds <= 60
        ? Math.round(chunkStaggerSeconds)
        : DEFAULT_CHUNK_STAGGER_SECONDS,
    chunkConcurrency:
      1,
    // Web demo: luon dung key admin qua proxy (nguoi dung web khong cau hinh key
    // rieng). Native (Android/iOS) ton trong lua chon da luu cua nguoi dung.
    useAdminKey: isWebDemo() ? true : useAdminKeyResult === 'true',
    googleClientId: googleClientIdResult || import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    googleApiKey: googleApiKeyResult || import.meta.env.VITE_GOOGLE_API_KEY || '',
  };

  _cachedSettings = settings;
  return settings;
};

export const saveAiSettings = async ({
  apiKey,
  realtimeModelId,
  analysisModelId,
  realtimeMode,
  transcriptionProvider,
  assemblyaiApiKey,
  groqApiKey,
  openaiApiKey,
  recordingProfile,
  noiseSuppressionLevel,
  echoCancellationLevel,
  autoGainLevel,
  preferredSampleRate,
  preferredChannelCount,
  chunkDurationMinutes,
  macroBatchMinutes,
  chunkStaggerSeconds,
  chunkConcurrency: _chunkConcurrency,
  useAdminKey,
  googleClientId,
  googleApiKey,
}: AiSettings) => {
  invalidateSettingsCache();

  await Promise.all([
    setStoredValue(API_KEY_KEY, apiKey.trim()),
    setStoredValue(MODEL_ID_KEY, analysisModelId.trim() || DEFAULT_ANALYSIS_MODEL_ID),
    setStoredValue(REALTIME_MODEL_ID_KEY, realtimeModelId.trim() || DEFAULT_REALTIME_MODEL_ID),
    setStoredValue(ANALYSIS_MODEL_ID_KEY, analysisModelId.trim() || DEFAULT_ANALYSIS_MODEL_ID),
    setStoredValue(REALTIME_MODE_KEY, realtimeMode),
    setStoredValue(TRANSCRIPTION_PROVIDER_KEY, transcriptionProvider),
    setStoredValue(ASSEMBLYAI_API_KEY_KEY, assemblyaiApiKey.trim()),
    setStoredValue(GROQ_API_KEY_KEY, groqApiKey.trim()),
    setStoredValue(OPENAI_API_KEY_KEY, openaiApiKey.trim()),
    setStoredValue(RECORDING_PROFILE_KEY, recordingProfile),
    setStoredValue(NOISE_SUPPRESSION_LEVEL_KEY, noiseSuppressionLevel),
    setStoredValue(ECHO_CANCELLATION_LEVEL_KEY, echoCancellationLevel),
    setStoredValue(AUTO_GAIN_LEVEL_KEY, autoGainLevel),
    setStoredValue(PREFERRED_SAMPLE_RATE_KEY, String(preferredSampleRate)),
    setStoredValue(PREFERRED_CHANNEL_COUNT_KEY, String(preferredChannelCount)),
    setStoredValue(
      CHUNK_DURATION_MINUTES_KEY,
      String(
        Number.isFinite(chunkDurationMinutes) && chunkDurationMinutes >= 1 && chunkDurationMinutes <= 30
          ? Math.round(chunkDurationMinutes)
          : DEFAULT_CHUNK_DURATION_MINUTES
      )
    ),
    setStoredValue(
      MACRO_BATCH_MINUTES_KEY,
      String(
        Number.isFinite(macroBatchMinutes) && macroBatchMinutes >= 5 && macroBatchMinutes <= 30
          ? Math.round(macroBatchMinutes)
          : DEFAULT_MACRO_BATCH_MINUTES
      )
    ),
    setStoredValue(
      CHUNK_STAGGER_SECONDS_KEY,
      String(
        Number.isFinite(chunkStaggerSeconds) && chunkStaggerSeconds >= 0 && chunkStaggerSeconds <= 60
          ? Math.round(chunkStaggerSeconds)
          : DEFAULT_CHUNK_STAGGER_SECONDS
      )
    ),
    setStoredValue(
      CHUNK_CONCURRENCY_KEY,
      String(1)
    ),
    setStoredValue(USE_ADMIN_KEY_KEY, String(useAdminKey)),
    setStoredValue(GOOGLE_CLIENT_ID_KEY, googleClientId.trim()),
    setStoredValue(GOOGLE_API_KEY_KEY, googleApiKey.trim()),
  ]);
};

export const clearAiApiKey = async () => {
  await removeStoredValue(API_KEY_KEY);
};

export const getDeviceId = async (): Promise<string> => {
  const key = 'device_id';
  const existing = await getSecureValue(key);
  if (existing) return existing;

  const newId = 'dev-' + Math.random().toString(36).slice(2, 11) + '-' + Date.now().toString(36);
  await setSecureValue(key, newId);
  return newId;
};

export interface LicenseInfo {
  valid: boolean;
  plan: string | null;
  expiresAt: string | null;
  features: string[];
  requestsLimit?: number | null;
  requestsUsed?: number;
  adsEnabled?: number;
  ownKeyPurchased?: number;
  error?: string;
}

export interface RuntimeConfig {
  features: string[];
  googleClientId: string;
  googleApiKey: string;
  error?: string;
  requestsLimit?: number;
  requestsUsed?: number;
  adsEnabled?: boolean;
  ownKeyPurchased?: boolean;
  admobAppId?: string;
  admobBannerId?: string;
  admobRewardedId?: string;
  customBannerHtml?: string;
  customBannerEnabled?: boolean;
}

export const checkLicenseStatus = async (): Promise<LicenseInfo> => {
  try {
    const deviceId = await getDeviceId();
    const { backendFetch } = await import('./backendClient');
    const response = await backendFetch(`/api/client/license?device_id=${encodeURIComponent(deviceId)}`);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Check license status failed:', error);
    return { valid: false, plan: null, expiresAt: null, features: [], error: String(error) };
  }
};

export const getRuntimeConfig = async (): Promise<RuntimeConfig> => {
  try {
    const deviceId = await getDeviceId();
    const { backendFetch } = await import('./backendClient');
    const response = await backendFetch(`/api/client/runtime-config?device_id=${encodeURIComponent(deviceId)}`);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Get runtime config failed:', error);
    return { features: [], googleClientId: '', googleApiKey: '', error: String(error) };
  }
};

export const redeemPromoCode = async (code: string): Promise<{ ok: boolean; plan?: string; expiresAt?: string; message?: string; error?: string }> => {
  try {
    const deviceId = await getDeviceId();
    const { backendFetch } = await import('./backendClient');
    const response = await backendFetch('/api/client/redeem', {
      method: 'POST',
      body: JSON.stringify({ deviceId, code }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Redeem code failed');
    }
    return data;
  } catch (error: any) {
    console.error('Redeem code failed:', error);
    return { ok: false, error: error.message || 'Lỗi khi kích hoạt promo code.' };
  }
};

export const getPaymentInfo = async (): Promise<any> => {
  try {
    const { backendFetch } = await import('./backendClient');
    const response = await backendFetch('/api/client/payment-info', {}, { includeDeviceAuth: false });
    if (!response.ok) {
      throw new Error('Get payment info failed');
    }
    return await response.json();
  } catch (error) {
    console.error('Get payment info failed:', error);
    return null;
  }
};
