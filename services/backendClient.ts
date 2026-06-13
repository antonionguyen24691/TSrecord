import { Capacitor } from '@capacitor/core';
import { getSecureValue, setSecureValue } from './secureStorage';

const DEVICE_TOKEN_KEY = 'backend_device_token';

const resolveDeviceId = async (): Promise<string> => {
  const { getDeviceId } = await import('./aiSettingsService');
  return getDeviceId();
};

export const getBackendUrl = (): string =>
  (import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '');

const readStoredToken = async (): Promise<string | null> =>
  getSecureValue(DEVICE_TOKEN_KEY);

const writeStoredToken = async (token: string): Promise<void> => {
  await setSecureValue(DEVICE_TOKEN_KEY, token);
};

const resolvePlayIntegrity = async (): Promise<{
  integrityToken?: string;
  integrityNonce?: string;
}> => {
  if (Capacitor.getPlatform() !== 'android') return {};

  try {
    const challengeResponse = await fetch(`${getBackendUrl()}/api/v2/devices/integrity/challenge`);
    if (!challengeResponse.ok) return {};

    const challenge = await challengeResponse.json() as {
      nonce?: string;
      cloudProjectNumber?: string | null;
      required?: boolean;
    };
    if (!challenge.nonce) return {};

    const { PlayIntegrity } = await import('../plugins/playIntegrity');
    const tokenResult = await PlayIntegrity.requestToken({
      nonce: challenge.nonce,
      cloudProjectNumber: challenge.cloudProjectNumber || undefined,
    });

    return {
      integrityToken: tokenResult.token,
      integrityNonce: challenge.nonce,
    };
  } catch {
    return {};
  }
};

export const registerBackendDevice = async (): Promise<void> => {
  const deviceKey = await resolveDeviceId();
  const integrity = await resolvePlayIntegrity();
  const response = await fetch(`${getBackendUrl()}/api/v2/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceKey,
      platform: Capacitor.getPlatform(),
      appVersion: import.meta.env.VITE_APP_VERSION || 'web',
      locale: navigator.language,
      ...integrity,
    }),
  });

  if (!response.ok) return;

  const data = await response.json() as { deviceToken?: string };
  if (data.deviceToken) {
    await writeStoredToken(data.deviceToken);
    const { setUserContext } = await import('./utils/crashReporter');
    setUserContext(deviceKey);
  }
};

export const backendFetch = async (
  path: string,
  init: RequestInit = {},
  options?: { includeDeviceAuth?: boolean; deviceId?: string }
): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options?.includeDeviceAuth !== false) {
    const token = await readStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return fetch(`${getBackendUrl()}${path}`, {
    ...init,
    headers,
  });
};

export type V2OrderResponse = {
  orderCode: string;
  checkoutUrl?: string;
  qrUrl?: string;
  transferContent?: string;
  accountName?: string;
  amountMinor?: number;
  currency?: string;
};

export const createV2Order = async (
  planCode: string,
  provider: 'sepay' | 'stripe'
): Promise<V2OrderResponse> => {
  const deviceKey = await resolveDeviceId();
  const response = await backendFetch('/api/v2/orders', {
    method: 'POST',
    body: JSON.stringify({ deviceKey, planCode, provider }),
  }, { deviceId: deviceKey });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Không thể tạo đơn hàng.');
  }
  return data;
};
