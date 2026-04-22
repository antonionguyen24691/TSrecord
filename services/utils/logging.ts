import { sanitizeError } from './errorSanitizer';

export const logError = (context: string, error: unknown) => {
  console.error(context, sanitizeError(error));
};

export const logWarning = (context: string, error: unknown) => {
  console.warn(context, sanitizeError(error));
};

