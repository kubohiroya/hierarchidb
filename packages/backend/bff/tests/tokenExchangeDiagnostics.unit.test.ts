import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthProviderError } from '../src/auth/OAuthProviderError.js';
import { exchangeCodeForToken } from '../src/auth/callback.js';
import type { RawEnv } from '../src/env-mapper.js';
import type { BffBindings } from '../src/utils/env.js';

const googleMocks = vi.hoisted(() => ({
  exchangeCodeForTokens: vi.fn(),
  getGoogleUserInfo: vi.fn(),
}));

const jwtMocks = vi.hoisted(() => ({
  createSessionToken: vi.fn(),
}));

vi.mock('../src/auth/google.js', () => googleMocks);
vi.mock('../src/utils/jwt.js', () => jwtMocks);

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

const requestToken = (body: Record<string, unknown>, env: RawEnv = baseEnv): Promise<Response> =>
  createApp().request(
    '/auth/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    env
  );

describe('token exchange diagnostics', () => {
  beforeEach(() => {
    googleMocks.exchangeCodeForTokens.mockReset().mockResolvedValue({
      access_token: 'provider-access-token',
      refresh_token: 'provider-refresh-token',
    });
    googleMocks.getGoogleUserInfo.mockReset().mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Example User',
      picture: 'https://example.com/avatar.png',
    });
    jwtMocks.createSessionToken.mockReset().mockResolvedValue('session-token');
    vi.restoreAllMocks();
  });

  it.each([undefined, '', 'unknown'])('rejects provider %s with HTTP 400', async (provider) => {
    const response = await requestToken({ code: 'sensitive-authorization-code', provider });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
      error_description: 'OAuth provider is required',
    });
    expect(googleMocks.exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it('logs a safe provider token exchange classification', async () => {
    googleMocks.exchangeCodeForTokens.mockRejectedValue(
      new OAuthProviderError({
        provider: 'google',
        operation: 'token_exchange',
        status: 400,
        providerErrorCode: 'invalid_grant',
      })
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await requestToken({
      code: 'sensitive-authorization-code',
      provider: 'google',
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'server_error',
      error_description: 'Failed to exchange token',
    });
    expect(consoleError).toHaveBeenCalledWith('[auth][token] exchange failed', {
      stage: 'provider_token_exchange',
      provider: 'google',
      errorType: 'OAuthProviderError',
      providerStatus: 400,
      providerErrorCode: 'invalid_grant',
    });
    const serializedLogs = JSON.stringify(consoleError.mock.calls);
    expect(serializedLogs).not.toContain('sensitive-authorization-code');
    expect(serializedLogs).not.toContain('test-google-secret');
  });

  it('classifies incomplete provider configuration without logging configured values', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await requestToken(
      { code: 'sensitive-authorization-code', provider: 'google' },
      { ...baseEnv, GOOGLE_CLIENT_SECRET: '' }
    );

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith('[auth][token] exchange failed', {
      stage: 'provider_configuration',
      provider: 'google',
      errorType: 'Error',
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('test-google-client');
  });

  it('classifies userinfo failures without logging the provider response', async () => {
    googleMocks.getGoogleUserInfo.mockRejectedValue(new Error('sensitive userinfo response'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await requestToken({
      code: 'sensitive-authorization-code',
      provider: 'google',
    });

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith('[auth][token] exchange failed', {
      stage: 'provider_userinfo',
      provider: 'google',
      errorType: 'Error',
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('sensitive userinfo response');
  });

  it('classifies session JWT failures without logging secret material', async () => {
    jwtMocks.createSessionToken.mockRejectedValue(new Error('test-jwt-secret'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await requestToken({
      code: 'sensitive-authorization-code',
      provider: 'google',
    });

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith('[auth][token] exchange failed', {
      stage: 'session_jwt',
      provider: 'google',
      errorType: 'Error',
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('test-jwt-secret');
  });

  it('classifies invalid session configuration', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await requestToken(
      { code: 'sensitive-authorization-code', provider: 'google' },
      { ...baseEnv, SESSION_DURATION_HOURS: 'invalid' }
    );

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith('[auth][token] exchange failed', {
      stage: 'session_configuration',
      provider: 'google',
      errorType: 'Error',
    });
  });

  it('reports KV degradation without logging the storage error message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const put = vi.fn().mockRejectedValue(new Error('sensitive KV failure detail'));

    const response = await requestToken(
      { code: 'sensitive-authorization-code', provider: 'google' },
      {
        ...baseEnv,
        AUTH_SESSION_MODE: 'persistent',
        AUTH_KV: { put } as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session_mode: 'stateless',
      warning: { code: 'kv_unavailable', operation: 'login', reason: 'kv_error' },
    });
    expect(consoleError).toHaveBeenCalledWith('[auth][token] session persistence degraded', {
      stage: 'session_persistence',
      provider: 'google',
      errorType: 'Error',
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('sensitive KV failure detail');
  });
});
