import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFeatures } from './clientService.js';

test('buildFeatures includes system_api_key for monthly plans', () => {
  const features = buildFeatures('monthly_20', false, false);
  assert.ok(features.includes('system_api_key'));
  assert.ok(features.includes('disable_ads'));
});

test('buildFeatures keeps ads for own_key_ads plan', () => {
  const features = buildFeatures('own_key_ads', true, true);
  assert.ok(features.includes('own_key'));
  assert.ok(!features.includes('disable_ads'));
});
