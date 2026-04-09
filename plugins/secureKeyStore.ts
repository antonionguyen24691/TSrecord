import { registerPlugin } from '@capacitor/core';

export interface SecureKeyStorePlugin {
  set(options: { key: string; value: string }): Promise<void>;
  get(options: { key: string }): Promise<{ value: string | null }>;
  remove(options: { key: string }): Promise<void>;
}

export const SecureKeyStore = registerPlugin<SecureKeyStorePlugin>('SecureKeyStore');
