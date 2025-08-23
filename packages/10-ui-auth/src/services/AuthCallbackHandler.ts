import { AuthProviderType } from '../types/AuthProviderType';
// Temporary implementation for secureConfig
const getSecureConfig = () => ({
  microsoftClientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
  microsoftClientSecret: import.meta.env.VITE_MICROSOFT_CLIENT_SECRET || '',
  githubClientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
  githubClientSecret: import.meta.env.VITE_GITHUB_CLIENT_SECRET || '',
});

// import { devError } from "@/shared/utils/logger";
const devError = (msg: string, ...args: any[]) => console.error(msg, ...args);
import { AuthUser } from '../types/AuthUser';

const STORAGE_KEY = 'multi-auth-user';
const PROVIDER_KEY = 'multi-auth-provider';
const REDIRECT_URL_KEY = 'multi-auth-redirect';
const CORS_PROXY_URL = import.meta.env.VITE_CORS_PROXY_BASE_URL || '';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
}

export class AuthCallbackHandler {
  static async handleCallback(): Promise<boolean> {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    // Get provider from storage
    const provider = localStorage.getItem(PROVIDER_KEY) as AuthProviderType | null;
    if (!provider) {
      devError('No auth provider found in storage');
      return false;
    }

    // Handle different OAuth flows
    let token: string | null = null;
    let code: string | null = null;

    // Google uses implicit flow (token in hash)
    if (provider === 'google') {
      token = hashParams.get('access_token');
    } else {
      // Microsoft and GitHub use authorization code flow
      code = urlParams.get('code');
    }

    if (!token && !code) {
      devError('No token or code found in callback');
      return false;
    }

    try {
      let tokenData: TokenResponse;

      if (token) {
        // Google implicit flow
        tokenData = {
          access_token: token,
          token_type: 'Bearer',
          expires_in: parseInt(hashParams.get('expires_in') || '3600'),
        };
      } else if (code) {
        // Exchange code for token
        tokenData = await this.exchangeCodeForToken(code, provider);
      } else {
        throw new Error('No authentication data found');
      }

      // Fetch user info
      const user = await this.fetchUserInfo(tokenData.access_token, provider);

      // Save user data
      const authUser: AuthUser = {
        ...user,
        access_token: tokenData.access_token,
        id_token: tokenData.id_token,
        expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
        provider,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      localStorage.setItem(PROVIDER_KEY, provider);

      // Handle redirect
      const redirectUrl = localStorage.getItem(REDIRECT_URL_KEY);
      if (redirectUrl) {
        localStorage.removeItem(REDIRECT_URL_KEY);
        window.location.href = redirectUrl;
      }

      return true;
    } catch (error) {
      devError('Auth callback error:', error);
      return false;
    }
  }

  private static async exchangeCodeForToken(
    code: string,
    provider: AuthProviderType
  ): Promise<TokenResponse> {
    const secureConfig = getSecureConfig();
    const redirectUri = window.location.origin + window.location.pathname;

    let tokenUrl: string;
    let body: URLSearchParams;

    switch (provider) {
      case 'microsoft':
        tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        body = new URLSearchParams({
          client_id: secureConfig.microsoftClientId || '',
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        });
        if (secureConfig.microsoftClientSecret) {
          body.append('client_secret', secureConfig.microsoftClientSecret);
        }
        break;

      case 'github':
        // GitHub requires backend to exchange code for token
        // For now, we'll use CORS proxy
        tokenUrl = `${CORS_PROXY_URL}/?url=${encodeURIComponent('https://github.com/login/oauth/access_token')}`;
        body = new URLSearchParams({
          client_id: secureConfig.githubClientId || '',
          client_secret: secureConfig.githubClientSecret || '',
          code,
          redirect_uri: redirectUri,
        });
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return await response.json();
  }

  private static async fetchUserInfo(
    accessToken: string,
    provider: AuthProviderType
  ): Promise<Omit<AuthUser, 'access_token' | 'id_token' | 'expires_at' | 'provider'>> {
    let userInfoUrl: string;
    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
    };

    switch (provider) {
      case 'google':
        userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
        break;

      case 'microsoft':
        userInfoUrl = 'https://graph.microsoft.com/v1.0/me';
        break;

      case 'github':
        userInfoUrl = 'https://api.github.com/user';
        headers['Accept'] = 'application/vnd.github.v3+json';
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    const response = await fetch(userInfoUrl, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }

    const data = await response.json();

    // Normalize user data across providers
    switch (provider) {
      case 'google':
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          picture: data.picture,
        };

      case 'microsoft':
        return {
          id: data.id,
          email: data.userPrincipalName || data.mail,
          name: data.displayName,
          // Microsoft doesn't provide direct image URL in basic profile
          picture: undefined,
        };

      case 'github': {
        // For GitHub, we may need to fetch email separately
        let email = data.email;
        if (!email) {
          const emailResponse = await fetch('https://api.github.com/user/emails', {
            headers,
          });
          if (emailResponse.ok) {
            const emails = await emailResponse.json();
            const primaryEmail = emails.find((e: { primary: boolean; email: string }) => e.primary);
            email = primaryEmail?.email || emails[0]?.email;
          }
        }
        return {
          id: data.id.toString(),
          email: email || '',
          name: data.name || data.login,
          picture: data.avatar_url,
        };
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}
