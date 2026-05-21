/**
 * crashReporter.ts
 * Placeholder for production crash monitoring.
 *
 * When ready, replace the implementations below with a real service
 * such as Sentry, Crashlytics, or a custom endpoint.
 *
 * Usage:
 *   import { reportError, setUserContext } from './utils/crashReporter';
 *   reportError(error, { component: 'GeminiService', action: 'transcribe' });
 */

interface ErrorContext {
  component?: string;
  action?: string;
  extra?: Record<string, unknown>;
}

export const initCrashReporter = () => {
  // TODO: Initialize Sentry or Crashlytics here
  // Example:
  //   Sentry.init({ dsn: 'YOUR_DSN', environment: import.meta.env.MODE });
};

export const reportError = (error: unknown, context?: ErrorContext) => {
  // TODO: Send to monitoring service
  // Example:
  //   Sentry.captureException(error, { extra: context });
  console.error('[CrashReporter]', context?.component || '', context?.action || '', error);
};

export const setUserContext = (_userId: string) => {
  // TODO: Associate errors with user identity
  // Example:
  //   Sentry.setUser({ id: userId });
};
