import { generateCodeChallenge, generateCodeVerifier, generateState } from '~/utils/pkce';
import { OAuthProviderError } from './OAuthProviderError.js';

export interface GoogleOAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export async function initiateGoogleAuth(config: GoogleOAuth2Config) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return {
    authUrl: authUrl.toString(),
    codeVerifier,
    state,
  };
}

export type ExchangeCodeForTokensReturn = {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
};

const readProviderErrorCode = (input: unknown): string | undefined => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined;
  const value = (input as Record<string, unknown>).error;
  if (typeof value !== 'string' || !/^[a-z0-9_.-]{1,64}$/i.test(value)) return undefined;
  return value;
};

export async function exchangeCodeForTokens(
  code: string,
  config: GoogleOAuth2Config,
  codeVerifier?: string
): Promise<ExchangeCodeForTokensReturn> {
  const params: Record<string, string> = {
    code,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  };

  if (config.clientSecret) {
    params.client_secret = config.clientSecret;
  }

  if (codeVerifier) {
    params.code_verifier = codeVerifier;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const providerErrorCode = readProviderErrorCode(body);
    throw new OAuthProviderError({
      provider: 'google',
      operation: 'token_exchange',
      status: response.status,
      ...(providerErrorCode === undefined ? {} : { providerErrorCode }),
    });
  }

  return await response.json();
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new OAuthProviderError({
      provider: 'google',
      operation: 'userinfo',
      status: response.status,
    });
  }

  return await response.json();
}
