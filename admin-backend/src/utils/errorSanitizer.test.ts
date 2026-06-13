import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeError, sanitizeUpstreamError } from './errorSanitizer.js';

test('sanitizeError redacts Gemini API keys', () => {
  const message = sanitizeError('Failed with key AIzaSyD-example-key-1234567890');
  assert.match(message, /\[REDACTED_SECRET\]/);
  assert.doesNotMatch(message, /AIzaSyD-example-key/);
});

test('sanitizeUpstreamError prefixes status code', () => {
  const message = sanitizeUpstreamError(502, 'upstream failed');
  assert.match(message, /Upstream HTTP 502/);
});
