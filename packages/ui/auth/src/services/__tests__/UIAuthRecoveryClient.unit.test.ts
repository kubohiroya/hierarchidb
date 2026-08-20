import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFFUser } from '../AuthSessionStorage.js';
import { AuthSessionStorage } from '../AuthSessionStorage.js';
import { registerAuthUIHandlers } from '../UIAuthRecoveryClient.js';

type RegisteredHandler = {
  onAuthRequired(notification: {
    context: { requestId: string; sessionId?: string };
  }): Promise<void>;
};

const registryMocks = vi.hoisted(() => ({
  dispatch: vi.fn(async () => undefined),
  register: vi.fn(),
}));

vi.mock('@hierarchidb/auth', () => ({
  AuthNotificationFactory: {
    createAuthCancelled: (params: Record<string, unknown>) => ({
      type: 'AUTH_CANCELLED',
      context: params,
    }),
    createAuthSuccess: (params: Record<string, unknown>) => ({
      type: 'AUTH_SUCCESS',
      context: params,
    }),
  },
  AuthNotificationRegistry: {
    getInstance: () => registryMocks,
  },
}));

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

const createUser = (): BFFUser => ({
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  access_token: 'session-token',
  expires_at: Date.now() + 3_600_000,
  provider: 'github',
  session_mode: 'stateless',
});

describe('registerAuthUIHandlers', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    registryMocks.dispatch.mockClear();
    registryMocks.register.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('persists the complete session before dispatching AUTH_SUCCESS', async () => {
    const user = createUser();
    registryMocks.dispatch.mockImplementation(async () => {
      expect(AuthSessionStorage.load()).toEqual(user);
    });
    registerAuthUIHandlers(async () => ({ user }));
    const handler = registryMocks.register.mock.calls[0]?.[1] as RegisteredHandler | undefined;
    if (!handler) throw new Error('Auth handler was not registered');

    await handler.onAuthRequired({ context: { requestId: 'request-1', sessionId: 'session-1' } });

    expect(registryMocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'AUTH_SUCCESS',
        context: expect.objectContaining({
          requestId: 'request-1',
          newToken: 'session-token',
        }),
      })
    );
  });
});
