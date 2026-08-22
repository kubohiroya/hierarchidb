import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeCodeForTokens, getGoogleUserInfo } from '../src/auth/google.js';
import { OAuthProviderError } from '../src/auth/OAuthProviderError.js';

const config = {
  clientId: 'google-client-id',
  clientSecret: 'google-client-secret',
  redirectUri: 'https://example.com/auth/callback',
};

describe('Google OAuth provider errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps only the provider status and machine-readable token error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'invalid_grant',
              error_description: 'sensitive provider detail',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
      )
    );

    const error = await exchangeCodeForTokens('sensitive-authorization-code', config).catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(OAuthProviderError);
    expect(error).toMatchObject({
      provider: 'google',
      operation: 'token_exchange',
      status: 400,
      providerErrorCode: 'invalid_grant',
    });
    expect(String(error)).not.toContain('sensitive provider detail');
    expect(String(error)).not.toContain('sensitive-authorization-code');
  });

  it('reports only the provider status for userinfo failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 }))
    );

    await expect(getGoogleUserInfo('sensitive-access-token')).rejects.toMatchObject({
      provider: 'google',
      operation: 'userinfo',
      status: 401,
      providerErrorCode: undefined,
    });
  });
});
