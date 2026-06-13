import assert from 'node:assert/strict';
import test from 'node:test';

test('issueDeviceToken and verifyDeviceToken round-trip', async () => {
  process.env.JWT_SECRET = 'test-device-auth-secret-32chars-min';
  delete process.env.DEVICE_AUTH_SECRET;

  const { issueDeviceToken, verifyDeviceToken } = await import('./deviceAuth.js');
  const token = issueDeviceToken('dev-test-device-001');
  const payload = verifyDeviceToken(token);

  assert.equal(payload?.deviceKey, 'dev-test-device-001');
});
