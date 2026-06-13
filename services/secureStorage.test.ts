import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
  },
  registerPlugin: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  })),
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async () => ({ value: null })),
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  },
}));

describe('secureStorage', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('isSecureKeyStoreSupported is true on ios and android', async () => {
    const { Capacitor } = await import('@capacitor/core');
    const { isSecureKeyStoreSupported } = await import('./secureStorage');

    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    expect(isSecureKeyStoreSupported()).toBe(true);

    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    expect(isSecureKeyStoreSupported()).toBe(true);

    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
    expect(isSecureKeyStoreSupported()).toBe(false);
  });
});
