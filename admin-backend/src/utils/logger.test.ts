import assert from 'node:assert/strict';
import test from 'node:test';

test('logger writes JSON lines', async () => {
  const originalLog = console.log;
  let output = '';
  console.log = (line?: unknown) => {
    output = String(line);
  };

  const { logger } = await import('./logger.js');
  logger.info('hello', { feature: 'test' });

  console.log = originalLog;
  const parsed = JSON.parse(output) as { level: string; message: string; feature: string };
  assert.equal(parsed.level, 'info');
  assert.equal(parsed.message, 'hello');
  assert.equal(parsed.feature, 'test');
});
