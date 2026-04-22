import { describe, expect, it } from 'vitest';
import { sanitizeError } from './errorSanitizer';

describe('sanitizeError', () => {
  it('redacts common API key patterns', () => {
    const sanitized = sanitizeError(
      new Error('Request failed with x-goog-api-key: AIza1234567890abcdefghijklmnopqrstuv')
    );

    expect(sanitized).toContain('[REDACTED_SECRET]');
    expect(sanitized).not.toContain('AIza1234567890abcdefghijklmnopqrstuv');
  });
});

