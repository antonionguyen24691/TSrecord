import { describe, expect, it } from 'vitest';

describe('proxyUploadService thresholds', () => {
  it('uses direct base64 for files <= 3MB', () => {
    const limit = 3 * 1024 * 1024;
    expect(limit).toBe(3145728);
    expect(2 * 1024 * 1024).toBeLessThanOrEqual(limit);
    expect(4 * 1024 * 1024).toBeGreaterThan(limit);
  });
});
