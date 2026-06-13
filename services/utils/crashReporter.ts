import { Capacitor } from '@capacitor/core';
import * as SentryReact from '@sentry/react';

interface ErrorContext {
  component?: string;
  action?: string;
  extra?: Record<string, unknown>;
}

let initialized = false;

const getSampleRate = (): number => {
  const raw = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.1;
};

const buildInitOptions = () => ({
  dsn: import.meta.env.VITE_SENTRY_DSN?.trim(),
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION || undefined,
  tracesSampleRate: getSampleRate(),
  beforeSend(event: SentryReact.ErrorEvent) {
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.Authorization;
    }
    return event;
  },
});

export const initCrashReporter = async () => {
  const options = buildInitOptions();
  if (!options.dsn || initialized) return;

  if (Capacitor.isNativePlatform()) {
    const SentryCapacitor = await import('@sentry/capacitor');
    SentryCapacitor.init(
      {
        ...options,
        integrations: [SentryReact.browserTracingIntegration()],
      },
      SentryReact.init
    );
  } else {
    SentryReact.init({
      ...options,
      integrations: [SentryReact.browserTracingIntegration()],
    });
  }

  initialized = true;
};

export const reportError = (error: unknown, context?: ErrorContext) => {
  if (initialized) {
    SentryReact.captureException(error, {
      tags: {
        component: context?.component,
        action: context?.action,
      },
      extra: context?.extra,
    });
    return;
  }

  console.error('[CrashReporter]', context?.component || '', context?.action || '', error);
};

export const setUserContext = (userId: string) => {
  if (!initialized) return;
  SentryReact.setUser({ id: userId });
};
