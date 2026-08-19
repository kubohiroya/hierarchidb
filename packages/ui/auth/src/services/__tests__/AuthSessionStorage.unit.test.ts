import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBFFAuthService } from '../../hooks/useAuth.js';
import { AUTH_SESSION_CHANGED_EVENT, AuthSessionStorage } from '../AuthSessionStorage.js';
import { BFFAuthService } from '../BFFAuthService.js';

const validTokenResponse = () => ({
  access_token: 'session-jwt',
  expires_in: 3600,
  userinfo: {
    sub: 'user-1',
    email: 'user@example.com',
    name: 'Example User',
    picture: 'https://example.com/avatar.png',
  },
  refresh_token_id: 'refresh-1',
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

describe('AuthSessionStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('persists a valid BFF token response and emits the same-tab change event', () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, listener);

    const user = AuthSessionStorage.persistTokenResponse(validTokenResponse(), 'github', 1_000);

    expect(user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Example User',
      picture: 'https://example.com/avatar.png',
      access_token: 'session-jwt',
      refresh_token: 'refresh-1',
      expires_at: 3_601_000,
      provider: 'github',
    });
    expect(localStorage.getItem('access_token')).toBe('session-jwt');
    expect(localStorage.getItem('refresh_token_id')).toBe('refresh-1');
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, listener);
  });

  it('rejects a token response without access_token and does not persist a partial session', () => {
    const response = validTokenResponse();
    const { access_token: _accessToken, ...missingAccessToken } = response;

    expect(() => AuthSessionStorage.persistTokenResponse(missingAccessToken, 'google')).toThrow(
      'access_token must be a non-empty string'
    );
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('userinfo')).toBeNull();
  });

  it('rejects missing expiry and required userinfo fields instead of applying defaults', () => {
    const missingExpiry = validTokenResponse();
    const { expires_in: _expiresIn, ...withoutExpiry } = missingExpiry;
    expect(() => AuthSessionStorage.parseTokenResponse(withoutExpiry, 'microsoft')).toThrow(
      'expires_in must be a positive finite number'
    );

    const missingSubject = validTokenResponse();
    const { sub: _subject, ...withoutSubject } = missingSubject.userinfo;
    expect(() =>
      AuthSessionStorage.parseTokenResponse(
        { ...missingSubject, userinfo: withoutSubject },
        'microsoft'
      )
    ).toThrow('userinfo.sub must be a non-empty string');
  });

  it('restores the exact persisted session after reload', () => {
    AuthSessionStorage.persistTokenResponse(validTokenResponse(), 'google', 5_000);

    expect(AuthSessionStorage.load()).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Example User',
      picture: 'https://example.com/avatar.png',
      access_token: 'session-jwt',
      refresh_token: 'refresh-1',
      expires_at: 3_605_000,
      provider: 'google',
    });
  });

  it('rejects persisted state when access_token and userinfo are not both present', () => {
    localStorage.setItem('access_token', 'session-jwt');

    expect(() => AuthSessionStorage.load()).toThrow(
      'access_token and userinfo must both be present'
    );
  });
});

describe('BFFAuthService callback contract', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    localStorage.clear();
    localStorage.setItem('pkce_code_verifier', 'verifier');
    localStorage.setItem('auth_provider', 'google');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('surfaces a successful HTTP response without access_token as a callback error', async () => {
    const response = validTokenResponse();
    const { access_token: _accessToken, ...missingAccessToken } = response;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(missingAccessToken), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );

    await expect(
      BFFAuthService.getInstance().handleCallback(
        new URLSearchParams({ code: 'missing-access-token' })
      )
    ).rejects.toThrow('access_token must be a non-empty string');
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('userinfo')).toBeNull();
  });

  it('persists a valid callback response that getCurrentUser can restore', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(validTokenResponse()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );

    const service = BFFAuthService.getInstance();
    const callbackUser = await service.handleCallback(
      new URLSearchParams({ code: 'valid-auth-session' })
    );

    expect(callbackUser.id).toBe('user-1');
    await expect(service.getCurrentUser()).resolves.toEqual(callbackUser);
  });
});

describe('useBFFAuthService session propagation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('becomes authenticated when callback persistence emits the same-tab event', async () => {
    const { result, unmount } = renderHook(() => useBFFAuthService());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      AuthSessionStorage.persistTokenResponse(validTokenResponse(), 'google');
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.id).toBe('user-1');

    act(() => {
      AuthSessionStorage.clear();
    });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    unmount();
  });
});
