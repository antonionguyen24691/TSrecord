import { describe, expect, it } from 'vitest';
import { createGeminiUserError } from './geminiError';
import { translateServiceMessage } from './serviceMessages';

describe('createGeminiUserError', () => {
  it('maps rate-limit errors to a retryable user message', () => {
    const error = createGeminiUserError(
      new Error('429 Too Many Requests: quota exceeded'),
      'Fallback message'
    );

    expect(error.message).toContain('quota');
    expect(error.message).toContain(translateServiceMessage('gemini.errors.retryHint'));
  });

  it('keeps secrets out of user-facing error details', () => {
    const error = createGeminiUserError(
      new Error('Invalid API key AIza1234567890abcdefghijklmnopqrstuv'),
      'Fallback message'
    );

    expect(error.message).toContain('[REDACTED_SECRET]');
    expect(error.message).not.toContain('AIza1234567890abcdefghijklmnopqrstuv');
  });
});
