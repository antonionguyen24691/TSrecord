import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntegrityNonce } from './playIntegrity.js';

test('createIntegrityNonce returns a non-empty base64url string', () => {
  const nonce = createIntegrityNonce();
  assert.ok(nonce.length >= 16);
  assert.match(nonce, /^[A-Za-z0-9_-]+$/);
});
