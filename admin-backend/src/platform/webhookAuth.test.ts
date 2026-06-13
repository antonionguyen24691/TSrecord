import assert from 'node:assert/strict';
import crypto from 'crypto';
import test from 'node:test';
import {
  verifyHmacSignature,
  verifyLegacySepaySignature,
  verifySepayApiKey,
} from './webhookAuth.js';

test('verifySepayApiKey accepts Apikey and Bearer forms', () => {
  assert.equal(verifySepayApiKey('Apikey secret-key', 'secret-key'), true);
  assert.equal(verifySepayApiKey('Bearer secret-key', 'secret-key'), true);
  assert.equal(verifySepayApiKey('Bearer wrong', 'secret-key'), false);
});

test('verifyHmacSignature validates sha256 digest', () => {
  const payload = Buffer.from('{"amount":1000}');
  const secret = 'test-secret';
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  assert.equal(verifyHmacSignature(payload, signature, secret), true);
  assert.equal(verifyHmacSignature(payload, 'deadbeef', secret), false);
});

test('verifyLegacySepaySignature matches serialized body', () => {
  const body = '{"transferAmount":39000}';
  const secret = 'legacy-secret';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyLegacySepaySignature(body, signature, secret), true);
});
