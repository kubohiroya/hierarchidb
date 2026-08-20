import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshToken, revokeToken } from '../src/auth/refresh.js';
import type { RawEnv } from '../src/env-mapper.js';
import { app as bffApp } from '../src/index.js';
import type { BffBindings } from '../src/utils/env.js';

const baseEnv: RawEnv = {
  GOOGLE_CLIENT_ID: 'test-google-client',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
  JWT_SECRET: 'test-jwt-secret',
  JWT_ISSUER: 'hierarchidb-bff-test',
  AUTH_SESSION_MODE: 'persistent',
  SESSION_DURATION_HOURS: '4',
  ENVIRONMENT: 'production',
  ALLOWED_ORIGINS: 'https://example.com',
  REDIRECT_URI: 'https://example.com/auth/callback',
};

const createAuthEndpointApp = () => {
  const app = new Hono<BffBindings>();
  app.post('/auth/refresh', refreshToken);
  app.post('/auth/revoke', revokeToken);
  return app;
};

describe('BFF KV warning responses', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires re-login when refresh has no AUTH_KV binding', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createAuthEndpointApp();
    const response = await app.request(
      '/auth/refresh',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-session-token',
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
      baseEnv
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'kv_unavailable',
      error_description: 'Token refresh is not available',
      warning: {
        code: 'kv_unavailable',
        operation: 'refresh',
        action: 'relogin',
        reason: 'missing_kv',
      },
    });
  });

  it('reports a KV read failure during refresh', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createAuthEndpointApp();
    const failingKv = {
      get: vi.fn().mockRejectedValue(new Error('KV read failed')),
    } as unknown as KVNamespace;
    const response = await app.request(
      '/auth/refresh',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-session-token',
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
      { ...baseEnv, AUTH_KV: failingKv }
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'kv_unavailable',
      warning: {
        code: 'kv_unavailable',
        operation: 'refresh',
        action: 'relogin',
        reason: 'kv_error',
      },
    });
  });

  it('completes revoke locally when AUTH_KV is not bound', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createAuthEndpointApp();
    const response = await app.request(
      '/auth/revoke',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test-session-token' },
      },
      baseEnv
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'Token revocation completed locally',
      warning: {
        code: 'kv_unavailable',
        operation: 'revoke',
        action: 'none',
        reason: 'missing_kv',
      },
    });
  });

  it('completes logout locally when AUTH_KV is not bound', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await bffApp.request(
      '/auth/logout',
      {
        method: 'POST',
        headers: { Origin: 'https://example.com' },
      },
      baseEnv
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'Logged out successfully',
      warning: {
        code: 'kv_unavailable',
        operation: 'logout',
        action: 'none',
        reason: 'missing_kv',
      },
    });
  });

  it('requires a new login without a warning in stateless mode', async () => {
    const app = createAuthEndpointApp();
    const response = await app.request(
      '/auth/refresh',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-session-token',
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
      { ...baseEnv, AUTH_SESSION_MODE: 'stateless' }
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'reauthentication_required',
      error_description: 'Stateless sessions cannot be refreshed; sign in again',
    });
  });

  it('does not access KV or return a warning for stateless revoke', async () => {
    const app = createAuthEndpointApp();
    const get = vi.fn().mockRejectedValue(new Error('KV must not be read'));
    const response = await app.request(
      '/auth/revoke',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test-session-token' },
      },
      {
        ...baseEnv,
        AUTH_SESSION_MODE: 'stateless',
        AUTH_KV: { get } as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'Token revocation completed locally',
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('does not access KV or return a warning for stateless logout', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const get = vi.fn().mockRejectedValue(new Error('KV must not be read'));
    const response = await bffApp.request(
      '/auth/logout',
      {
        method: 'POST',
        headers: { Origin: 'https://example.com' },
      },
      {
        ...baseEnv,
        AUTH_SESSION_MODE: 'stateless',
        AUTH_KV: { get } as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: 'Logged out successfully' });
    expect(get).not.toHaveBeenCalled();
  });
});
