import { sanitizeError } from './errorSanitizer';
import { translateServiceMessage } from './serviceMessages';

interface ErrorMapping {
  pattern: RegExp;
  userMessage: string;
  retryable: boolean;
}

const GEMINI_ERROR_MAPPINGS: ErrorMapping[] = [
  {
    pattern: /\b(400|invalid_argument|api key|apikey|invalid api)\b/i,
    userMessage: translateServiceMessage('gemini.errors.invalidApiKeyOrModel'),
    retryable: false,
  },
  {
    pattern: /\b(401|403|permission|unauthori[sz]ed|forbidden)\b/i,
    userMessage: translateServiceMessage('gemini.errors.unauthorizedModel'),
    retryable: false,
  },
  {
    pattern: /\b(413|payload too large|file too large|file qua lon|request entity too large)\b/i,
    userMessage: translateServiceMessage('gemini.errors.fileTooLarge'),
    retryable: false,
  },
  {
    pattern: /\b(408|timeout|timed out|deadline|abort)\b/i,
    userMessage: translateServiceMessage('gemini.errors.timeout'),
    retryable: true,
  },
  {
    pattern: /\b(429|too many requests|quota|rate limit|resource_exhausted)\b/i,
    userMessage: translateServiceMessage('gemini.errors.quota'),
    retryable: true,
  },
  {
    pattern: /\b(500|internal)\b/i,
    userMessage: translateServiceMessage('gemini.errors.temporary'),
    retryable: true,
  },
  {
    pattern: /\b(502|503|504|unavailable|overloaded|service unavailable)\b/i,
    userMessage: translateServiceMessage('gemini.errors.unavailable'),
    retryable: true,
  },
  {
    pattern: /\b(fetch|network|failed to fetch|internet|offline)\b/i,
    userMessage: translateServiceMessage('gemini.errors.network'),
    retryable: true,
  },
];

export const createGeminiUserError = (
  error: unknown,
  fallbackMessage: string
): Error => {
  const safeDetails = sanitizeError(error);
  const matched = GEMINI_ERROR_MAPPINGS.find(({ pattern }) => pattern.test(safeDetails));
  const userMessage = matched?.userMessage || fallbackMessage;
  const retryHint = matched?.retryable
    ? ` ${translateServiceMessage('gemini.errors.retryHint')}`
    : '';

  return new Error(`${userMessage}${retryHint} (${safeDetails})`);
};
