import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SecureKeyStore } from '../plugins/secureKeyStore';

export const isSecureKeyStoreSupported = (): boolean => {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios';
};

export const getSecureValue = async (key: string): Promise<string | null> => {
  if (isSecureKeyStoreSupported()) {
    const result = await SecureKeyStore.get({ key });
    return result.value?.trim() || null;
  }
  const result = await Preferences.get({ key });
  return result.value?.trim() || null;
};

export const setSecureValue = async (key: string, value: string): Promise<void> => {
  if (isSecureKeyStoreSupported()) {
    await SecureKeyStore.set({ key, value });
    return;
  }
  await Preferences.set({ key, value });
};

export const removeSecureValue = async (key: string): Promise<void> => {
  if (isSecureKeyStoreSupported()) {
    await SecureKeyStore.remove({ key });
    return;
  }
  await Preferences.remove({ key });
};
