import assert from 'node:assert/strict';
import test from 'node:test';
import { extractOrderCode } from './commerce.js';

test('extractOrderCode prefers the structured SePay code', () => {
  assert.equal(
    extractOrderCode('tsr12ab34cd56ef', 'ignored content'),
    'TSR12AB34CD56EF'
  );
});

test('extractOrderCode finds the opaque order code in transfer content', () => {
  assert.equal(
    extractOrderCode(null, 'Thanh toan TSRABCDEF123456 cho don hang'),
    'TSRABCDEF123456'
  );
});

test('extractOrderCode rejects legacy free-form identifiers', () => {
  assert.equal(
    extractOrderCode(null, 'TSRECORD email@example.com MONTHLY_20 3M'),
    null
  );
});
