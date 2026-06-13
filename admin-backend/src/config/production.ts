import { usePostgresBackend } from '../runtime.js';

const INSECURE_JWT = 'dev-secret-change-me';
const INSECURE_ADMIN_PASSWORD = 'admin123';

const isProduction = (): boolean =>
  process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

export const validateProductionConfig = (): void => {
  if (!isProduction()) return;

  const errors: string[] = [];

  if (usePostgresBackend()) {
    if (!process.env.DATABASE_URL?.trim()) {
      errors.push('DATABASE_URL is required in production.');
    }
    if (!process.env.ADMIN_API_KEY?.trim()) {
      errors.push('ADMIN_API_KEY is required in production.');
    }
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret || jwtSecret === INSECURE_JWT) {
    errors.push('JWT_SECRET must be set to a strong random value in production.');
  }

  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (adminPassword === INSECURE_ADMIN_PASSWORD) {
    errors.push('ADMIN_PASSWORD must not use the default admin123 in production.');
  }

  if (usePostgresBackend()) {
    const hasSepaySecret = Boolean(
      process.env.SEPAY_WEBHOOK_API_KEY?.trim()
      || process.env.SEPAY_WEBHOOK_HMAC_SECRET?.trim()
    );
    const hasStripeSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
    if (!hasSepaySecret && !hasStripeSecret) {
      errors.push('At least one webhook secret (SEPAY_* or STRIPE_WEBHOOK_SECRET) is required.');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Production configuration invalid:\n- ${errors.join('\n- ')}`);
  }
};

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (isProduction()) {
    throw new Error('JWT_SECRET is required in production.');
  }
  return INSECURE_JWT;
};

export const getAdminPassword = (): string => {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (password) return password;
  if (isProduction()) {
    throw new Error('ADMIN_PASSWORD is required in production.');
  }
  return INSECURE_ADMIN_PASSWORD;
};
