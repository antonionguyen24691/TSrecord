import * as Sentry from '@sentry/node';

let initialized = false;

export const initSentry = () => {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  });

  initialized = true;
};

export const captureBackendException = (error: unknown, context?: Record<string, unknown>) => {
  if (!initialized) return;
  Sentry.captureException(error, { extra: context });
};

export const isSentryEnabled = () => initialized;
