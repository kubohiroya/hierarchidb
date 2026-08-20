import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeCodeForToken } from '../src/auth/callback.js';
import type { RawEnv } from '../src/env-mapper.js';
import type { BffBindings } from '../src/utils/env.js';

vi.mock('../src/auth/google.js', () => ({
  exchangeCodeForTokens: vi.fn(async () => ({
    access_token: 'provider-access-token',
    refresh_token: 'provider-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
  })),
  getGoogleUserInfo: vi.fn(async () => ({
    id: 'user-1',
    email: 'user@example.com',
    name: 'Example User',
    picture: 'https://example.com/avatar.png',
  })),
}));

const baseEnv: RawEnv = {
  GOOGLE_CLIENT_ID: 'test-google-client',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
  JWT_SECRET: 'test-jwt-secret',
  JWT_ISSUER: 'hierarchidb-bff-test',
  AUTH_SESSION_MODE: 'stateless',
  SESSION_DURATION_HOURS: '4',
  ALLOWED_ORIGINS: 'https://example.com',
  REDIRECT_URI: 'https://example.com/auth/callback',
};

const createApp = () => {
  const app = new Hono<BffBindings>();
  app.post('/auth/token', exchangeCodeForToken);
  return app;
};

const requestToken = (env: RawEnv) =>
  createApp().request(
    '/auth/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'authorization-code', provider: 'google' }),
    },
    env
  );

describe('login session mode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a short-lived stateless token without accessing KV or warning', async () => {
    const put = vi.fn();
    const response = await requestToken({
      ...baseEnv,
      AUTH_KV: { put } as unknown as KVNamespace,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      expires_in: 4 * 3600,
      session_mode: 'stateless',
    });
    expect(body).not.toHaveProperty('refresh_token_id');
    expect(body).not.toHaveProperty('warning');
    expect(put).not.toHaveBeenCalled();
  });

  it('persists and returns a refresh ID in persistent mode', async () => {
    const put = vi.fn(async () => undefined);
    const response = await requestToken({
      ...baseEnv,
      AUTH_SESSION_MODE: 'persistent',
      AUTH_KV: { put } as unknown as KVNamespace,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.session_mode).toBe('persistent');
    expect(body.refresh_token_id).toEqual(expect.any(String));
    expect(body).not.toHaveProperty('warning');
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('warns and returns an effective stateless token when persistent KV is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await requestToken({ ...baseEnv, AUTH_SESSION_MODE: 'persistent' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session_mode: 'stateless',
      warning: {
        code: 'kv_unavailable',
        operation: 'login',
        action: 'none',
        reason: 'missing_kv',
      },
    });
  });

  it('warns and returns an effective stateless token when persistent KV fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const put = vi.fn().mockRejectedValue(new Error('KV write failed'));
    const response = await requestToken({
      ...baseEnv,
      AUTH_SESSION_MODE: 'persistent',
      AUTH_KV: { put } as unknown as KVNamespace,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session_mode: 'stateless',
      warning: {
        code: 'kv_unavailable',
        operation: 'login',
        action: 'none',
        reason: 'kv_error',
      },
    });
  });
});
