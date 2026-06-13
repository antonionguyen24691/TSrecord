import assert from 'node:assert/strict';
import test from 'node:test';

test('usePostgresBackend is true when DATABASE_URL is set', async () => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://example';
  const { usePostgresBackend } = await import('./runtime.js');
  assert.equal(usePostgresBackend(), true);
  process.env.DATABASE_URL = previous;
});

test('usePostgresBackend is false when DATABASE_URL is missing', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const { usePostgresBackend } = await import('./runtime.js');
  assert.equal(usePostgresBackend(), false);
  process.env.DATABASE_URL = previous;
});
