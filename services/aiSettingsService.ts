import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SecureKeyStore } from '../plugins/secureKeyStore';

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

const SECURE_KEYSTORE_SUPPORTED = Capacitor.getPlatform() === 'android';

// --- Defaults ---
export const DEFAULT_MODEL_ID = 'gemini-2.5-flash';
export const DEFAULT_REALTIME_MODEL_ID = 'gemini-2.5-flash-lite';
export const DEFAULT_ANALYSIS_MODEL_ID = 'gemini-2.5-flash';
export type RealtimeMode = 'FULL' | 'HYBRID' | 'OFF';
export const DEFAULT_REALTIME_MODE: RealtimeMode = 'HYBRID';
export type TranscriptionProvider = 'gemini' | 'assemblyai' | 'groq' | 'openai';
export const DEFAULT_TRANSCRIPTION_PROVIDER: TranscriptionProvider = 'gemini';

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
}

// --- Storage Helpers ---
const getStoredValue = async (key: string) => {
  if (SECURE_KEYSTORE_SUPPORTED) {
    const result = await SecureKeyStore.get({ key });
    return result.value?.trim() || '';
  }
  const result = await Preferences.get({ key });
  return result.value?.trim() || '';
};

const setStoredValue = async (key: string, value: string) => {
  if (SECURE_KEYSTORE_SUPPORTED) {
    await SecureKeyStore.set({ key, value });
    return;
  }
  await Preferences.set({ key, value });
};

const removeStoredValue = async (key: string) => {
  if (SECURE_KEYSTORE_SUPPORTED) {
    await SecureKeyStore.remove({ key });
    return;
  }
  await Preferences.remove({ key });
};

// --- Public API ---
export const loadAiSettings = async (): Promise<AiSettings> => {
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
  ]);

  const fallbackModel = legacyModelIdResult || DEFAULT_MODEL_ID;
  const validProviders: TranscriptionProvider[] = ['gemini', 'assemblyai', 'groq', 'openai'];
  const provider = validProviders.includes(transcriptionProviderResult as TranscriptionProvider)
    ? (transcriptionProviderResult as TranscriptionProvider)
    : DEFAULT_TRANSCRIPTION_PROVIDER;

  const sanitizeModelId = (id: string, defaultId: string) => {
    let cleanId = id || fallbackModel || defaultId;
    // Map previous or user-tampered versions to the correct API ID
    if (cleanId === 'gemini-3.1-flash-lite' || cleanId === 'gemini 3.1 flash lite') {
      return 'gemini-3.1-flash-lite-preview';
    }
    return cleanId;
  };

  return {
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
  };
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
}: AiSettings) => {
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
  ]);
};

export const clearAiApiKey = async () => {
  await removeStoredValue(API_KEY_KEY);
};
