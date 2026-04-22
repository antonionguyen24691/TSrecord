const SECRET_PATTERNS = [
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\bsk-[0-9A-Za-z_-]{20,}\b/g,
  /\b(gsk|gsk_)[0-9A-Za-z_-]{20,}\b/gi,
  /\b(api[_-]?key|x-goog-api-key|authorization|bearer)\b\s*[:=]\s*["']?[^"',\s)]+/gi,
];

const MAX_ERROR_LENGTH = 800;

const stringifyError = (error: unknown): string => {
  if (error instanceof Error) {
    return [error.name, error.message].filter(Boolean).join(': ');
  }

  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const sanitizeError = (error: unknown): string => {
  let message = stringifyError(error);

  for (const pattern of SECRET_PATTERNS) {
    message = message.replace(pattern, '[REDACTED_SECRET]');
  }

  return message.length > MAX_ERROR_LENGTH
    ? `${message.slice(0, MAX_ERROR_LENGTH)}...`
    : message;
};

