import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_BACKEND_URL', 'https://api.example.com/');

describe('backendClient', () => {
  it('getBackendUrl strips trailing slashes', async () => {
    const { getBackendUrl } = await import('./backendClient');
    expect(getBackendUrl()).toBe('https://api.example.com');
  });
});
