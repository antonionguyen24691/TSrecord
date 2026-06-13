import assert from 'node:assert/strict';
import test from 'node:test';

test('validateProductionConfig passes in non-production without secrets', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercel = process.env.VERCEL;
  delete process.env.VERCEL;
  process.env.NODE_ENV = 'development';

  const { validateProductionConfig } = await import('./production.js');
  assert.doesNotThrow(() => validateProductionConfig());

  process.env.NODE_ENV = previousNodeEnv;
  process.env.VERCEL = previousVercel;
});

test('validateProductionConfig fails with insecure JWT in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousJwt = process.env.JWT_SECRET;
  const previousDb = process.env.DATABASE_URL;
  const previousAdminKey = process.env.ADMIN_API_KEY;
  const previousSepay = process.env.SEPAY_WEBHOOK_API_KEY;

  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = 'postgresql://example';
  process.env.ADMIN_API_KEY = 'secure-admin-key';
  process.env.SEPAY_WEBHOOK_API_KEY = 'webhook-key';
  process.env.JWT_SECRET = 'dev-secret-change-me';

  const { validateProductionConfig } = await import('./production.js');
  assert.throws(() => validateProductionConfig(), /JWT_SECRET/);

  process.env.NODE_ENV = previousNodeEnv;
  process.env.JWT_SECRET = previousJwt;
  process.env.DATABASE_URL = previousDb;
  process.env.ADMIN_API_KEY = previousAdminKey;
  process.env.SEPAY_WEBHOOK_API_KEY = previousSepay;
});
