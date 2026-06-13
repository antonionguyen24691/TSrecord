import { sanitizeError } from './errorSanitizer';
import { reportError } from './crashReporter';

export const logError = (context: string, error: unknown) => {
  const message = sanitizeError(error);
  console.error(context, message);
  reportError(error instanceof Error ? error : new Error(message), {
    component: context,
    action: 'logError',
  });
};

export const logWarning = (context: string, error: unknown) => {
  console.warn(context, sanitizeError(error));
};

