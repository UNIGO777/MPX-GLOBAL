import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Tracker G5: a release build must refuse to talk to the API over plain http.
 * `config/env.js` resolves the base URL at import time and throws on a bad one,
 * so each case imports a fresh copy with the URL and build type it needs.
 */
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {}, version: '1.0.0' } } }));

async function loadWith(url, { dev = false } = {}) {
  vi.resetModules();
  globalThis.__DEV__ = dev;
  process.env.EXPO_PUBLIC_API_BASE_URL = url;
  return import('../src/config/env.js');
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  globalThis.__DEV__ = false;
});

describe('API base URL (G5 — no cleartext in a release build)', () => {
  it('accepts https and drops a trailing slash', async () => {
    const { env } = await loadWith('https://api.mpx.nxtgendigitals.com/');
    expect(env.apiBaseUrl).toBe('https://api.mpx.nxtgendigitals.com');
  });

  it('refuses http in a release build, even for localhost', async () => {
    await expect(loadWith('http://api.mpx.nxtgendigitals.com')).rejects.toThrow(/must use https/);
    await expect(loadWith('http://localhost:3000')).rejects.toThrow(/must use https/);
  });

  it('allows http only in a dev build, and only to this machine or the LAN', async () => {
    expect((await loadWith('http://192.168.1.20:3000', { dev: true })).env.apiBaseUrl).toBe('http://192.168.1.20:3000');
    expect((await loadWith('http://10.0.2.2:3000', { dev: true })).env.apiBaseUrl).toBe('http://10.0.2.2:3000');
    await expect(loadWith('http://evil.example.com', { dev: true })).rejects.toThrow(/must use https/);
  });

  it('refuses a missing URL, a relative one and one carrying credentials', async () => {
    await expect(loadWith('')).rejects.toThrow(/not set/);
    await expect(loadWith('/api')).rejects.toThrow(/absolute URL/);
    await expect(loadWith('https://user:pass@api.example.com')).rejects.toThrow(/no embedded credentials/);
  });
});
