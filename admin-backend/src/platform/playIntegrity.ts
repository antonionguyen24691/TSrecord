import crypto from 'crypto';
import { GoogleAuth } from 'google-auth-library';

type IntegrityVerdict = {
  valid: boolean;
  appRecognized?: boolean;
  deviceIntegrity?: string;
  licensingVerdict?: string;
  error?: string;
};

type DecodeResponse = {
  tokenPayloadExternal?: {
    requestDetails?: { nonce?: string };
    appIntegrity?: {
      appRecognitionVerdict?: string;
      packageName?: string;
    };
    deviceIntegrity?: {
      deviceRecognitionVerdict?: string[];
    };
    accountDetails?: {
      appLicensingVerdict?: string;
    };
  };
};

const INTEGRITY_SCOPE = 'https://www.googleapis.com/auth/playintegrity';

const parseServiceAccount = (): Record<string, unknown> | null => {
  const inline = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    try {
      return JSON.parse(inline) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
};

const getPackageName = (): string | null =>
  process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() || null;

export const isPlayIntegrityConfigured = (): boolean =>
  Boolean(getPackageName() && (parseServiceAccount() || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()));

export const isPlayIntegrityRequired = (): boolean =>
  process.env.PLAY_INTEGRITY_REQUIRED === 'true' && isPlayIntegrityConfigured();

export const getPlayIntegrityCloudProjectNumber = (): string | undefined =>
  process.env.GOOGLE_CLOUD_PROJECT_NUMBER?.trim() || undefined;

export const createIntegrityNonce = (): string =>
  crypto.randomBytes(24).toString('base64url');

const getAccessToken = async (): Promise<string | null> => {
  const credentials = parseServiceAccount();
  const auth = new GoogleAuth({
    credentials: credentials ?? undefined,
    scopes: [INTEGRITY_SCOPE],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token || null;
};

export const verifyPlayIntegrityToken = async (
  integrityToken: string,
  expectedNonce: string
): Promise<IntegrityVerdict> => {
  const packageName = getPackageName();
  if (!packageName) {
    return { valid: false, error: 'GOOGLE_PLAY_PACKAGE_NAME chưa được cấu hình.' };
  }
  if (!integrityToken.trim()) {
    return { valid: false, error: 'Thiếu integrity token.' };
  }
  if (!expectedNonce.trim()) {
    return { valid: false, error: 'Thiếu nonce.' };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { valid: false, error: 'Không lấy được Google access token.' };
  }

  const response = await fetch(
    `https://playintegrity.googleapis.com/v1/${packageName}:decodeIntegrityToken`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ integrityToken }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return {
      valid: false,
      error: `Play Integrity API ${response.status}: ${body.slice(0, 240)}`,
    };
  }

  const payload = await response.json() as DecodeResponse;
  const external = payload.tokenPayloadExternal;
  const nonce = external?.requestDetails?.nonce;
  if (!nonce || nonce !== expectedNonce) {
    return { valid: false, error: 'Nonce không khớp.' };
  }

  const packageMatch = external?.appIntegrity?.packageName === packageName;
  const appVerdict = external?.appIntegrity?.appRecognitionVerdict || 'UNKNOWN';
  const deviceVerdicts = external?.deviceIntegrity?.deviceRecognitionVerdict || [];
  const licensingVerdict = external?.accountDetails?.appLicensingVerdict || 'UNKNOWN';

  const appRecognized = packageMatch && appVerdict === 'PLAY_RECOGNIZED';
  const deviceOk = deviceVerdicts.some((verdict) =>
    ['MEETS_DEVICE_INTEGRITY', 'MEETS_STRONG_INTEGRITY', 'MEETS_BASIC_INTEGRITY'].includes(verdict)
  );

  return {
    valid: appRecognized && deviceOk,
    appRecognized,
    deviceIntegrity: deviceVerdicts.join(','),
    licensingVerdict,
    error: appRecognized && deviceOk ? undefined : 'Thiết bị hoặc ứng dụng không đạt yêu cầu integrity.',
  };
};
