import { sanitizeError } from './errorSanitizer';

interface ErrorMapping {
  pattern: RegExp;
  userMessage: string;
  retryable: boolean;
}

const GEMINI_ERROR_MAPPINGS: ErrorMapping[] = [
  {
    pattern: /\b(400|invalid_argument|api key|apikey|invalid api)\b/i,
    userMessage: 'Gemini API Key khong hop le hoac model hien tai khong kha dung.',
    retryable: false,
  },
  {
    pattern: /\b(401|403|permission|unauthori[sz]ed|forbidden)\b/i,
    userMessage: 'Gemini API Key khong co quyen truy cap model nay.',
    retryable: false,
  },
  {
    pattern: /\b(413|payload too large|file too large|file qua lon|request entity too large)\b/i,
    userMessage: 'File qua lon so voi gioi han cua AI.',
    retryable: false,
  },
  {
    pattern: /\b(408|timeout|timed out|deadline|abort)\b/i,
    userMessage: 'Gemini xu ly qua lau. Vui long thu lai voi file ngan hon hoac provider khac.',
    retryable: true,
  },
  {
    pattern: /\b(429|too many requests|quota|rate limit|resource_exhausted)\b/i,
    userMessage: 'Gemini dang bi gioi han luot goi hoac quota. Vui long doi mot luc roi thu lai.',
    retryable: true,
  },
  {
    pattern: /\b(500|internal)\b/i,
    userMessage: 'Gemini dang gap loi tam thoi. Vui long thu lai sau.',
    retryable: true,
  },
  {
    pattern: /\b(502|503|504|unavailable|overloaded|service unavailable)\b/i,
    userMessage: 'Gemini dang qua tai hoac khong san sang. Vui long thu lai sau.',
    retryable: true,
  },
  {
    pattern: /\b(fetch|network|failed to fetch|internet|offline)\b/i,
    userMessage: 'Loi ket noi mang. Vui long kiem tra internet.',
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
  const retryHint = matched?.retryable ? ' Co the thu lai.' : '';

  return new Error(`${userMessage}${retryHint} (${safeDetails})`);
};
