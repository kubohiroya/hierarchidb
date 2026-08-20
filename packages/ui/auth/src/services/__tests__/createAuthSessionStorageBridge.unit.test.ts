import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionStorage, type BFFUser } from '../AuthSessionStorage.js';
import { createAuthSessionStorageBridge } from '../createAuthSessionStorageBridge.js';

const createUser = (): BFFUser => ({
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  access_token: 'session-token',
  expires_at: 4_100_000,
  provider: 'github',
  session_mode: 'stateless',
});

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
};

describe('createAuthSessionStorageBridge', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns null only when no authenticated session exists', async () => {
    const bridge = createAuthSessionStorageBridge();

    await expect(bridge.getItem('access_token')).resolves.toBeNull();
    await expect(bridge.getItem('token_expires_at')).resolves.toBeNull();
  });

  it('returns the token and normalized expiration from a validated session', async () => {
    AuthSessionStorage.persist(createUser());
    const bridge = createAuthSessionStorageBridge();

    await expect(bridge.getItem('access_token')).resolves.toBe('session-token');
    await expect(bridge.getItem('token_expires_at')).resolves.toBe('4100');
  });

  it('rejects a partially persisted session', async () => {
    localStorage.setItem('access_token', 'partial-token');
    const bridge = createAuthSessionStorageBridge();

    await expect(bridge.getItem('access_token')).rejects.toThrow(
      'access_token and userinfo must both be present'
    );
  });

  it('propagates storage access failures', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const bridge = createAuthSessionStorageBridge();

    await expect(bridge.getItem('access_token')).rejects.toThrow('storage unavailable');
  });

  it('clears the canonical session atomically', async () => {
    AuthSessionStorage.persist(createUser());
    const bridge = createAuthSessionStorageBridge();

    await bridge.removeItem('access_token');

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('userinfo')).toBeNull();
    expect(localStorage.getItem('refresh_token_id')).toBeNull();
  });
});
