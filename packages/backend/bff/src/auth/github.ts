import { generateState } from '../utils/pkce';

export interface GitHubOAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GitHubUserInfo {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

export async function initiateGitHubAuth(config: GitHubOAuth2Config) {
  const state = generateState();

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('scope', 'read:user user:email');
  authUrl.searchParams.set('state', state);

  return {
    authUrl: authUrl.toString(),
    codeVerifier: '', // GitHub doesn't support PKCE
    state,
  };
}

export async function exchangeCodeForTokens(
  code: string,
  config: GitHubOAuth2Config
): Promise<{ access_token: string }> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange code for tokens');
  }

  return await response.json();
}

export async function getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return await response.json();
}
