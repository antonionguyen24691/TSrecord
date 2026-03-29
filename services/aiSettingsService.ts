import { Preferences } from '@capacitor/preferences';

const API_KEY_KEY = 'gemini_api_key';
const MODEL_ID_KEY = 'gemini_model_id';

export const DEFAULT_MODEL_ID = 'gemini-2.0-flash-exp';

export interface AiSettings {
  apiKey: string;
  modelId: string;
}

export const loadAiSettings = async (): Promise<AiSettings> => {
  const [apiKeyResult, modelIdResult] = await Promise.all([
    Preferences.get({ key: API_KEY_KEY }),
    Preferences.get({ key: MODEL_ID_KEY }),
  ]);

  return {
    apiKey: apiKeyResult.value?.trim() || '',
    modelId: modelIdResult.value?.trim() || DEFAULT_MODEL_ID,
  };
};

export const saveAiSettings = async ({ apiKey, modelId }: AiSettings) => {
  await Promise.all([
    Preferences.set({ key: API_KEY_KEY, value: apiKey.trim() }),
    Preferences.set({ key: MODEL_ID_KEY, value: modelId.trim() || DEFAULT_MODEL_ID }),
  ]);
};

export const clearAiApiKey = async () => {
  await Preferences.remove({ key: API_KEY_KEY });
};
