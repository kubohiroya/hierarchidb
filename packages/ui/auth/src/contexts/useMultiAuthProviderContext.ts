import { useGoogleLogin } from '@react-oauth/google';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthContextType } from '~/types/AuthContextType';
import type { AuthProviderConfig } from '~/types/AuthProviderConfig';
import type { AuthProviderType } from '~/types/AuthProviderType';
import type { AuthUser } from '~/types/AuthUser';

const getSecureConfig = () => ({
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID || '',
  microsoftClientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
  githubClientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
  githubClientSecret: import.meta.env.VITE_GITHUB_CLIENT_SECRET || '',
});

const notify = {
  error: (message: string) => console.error(message),
};

const STORAGE_KEY = 'multi-auth-user';
const REDIRECT_URL_KEY = 'multi-auth-redirect';
const PROVIDER_KEY = 'multi-auth-provider';

const getProviderConfig = (provider: AuthProviderType, homeUrl = '/'): AuthProviderConfig => {
  const secureConfig = getSecureConfig();
  const redirectUri = `${window.location.origin}${homeUrl}redirect`;

  switch (provider) {
    case 'google':
      return {
        type: 'google',
        clientId: secureConfig.oidcClientId || '',
        scope: 'openid profile email',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        redirectUri,
      };
    case 'microsoft':
      return {
        type: 'microsoft',
        clientId: secureConfig.microsoftClientId || '',
        scope: 'openid profile email User.Read',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        redirectUri,
      };
    case 'github':
      return {
        type: 'github',
        clientId: secureConfig.githubClientId || '',
        clientSecret: secureConfig.githubClientSecret || '',
        scope: 'read:user user:email',
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        redirectUri,
      };
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

export interface UseMultiAuthProviderContextParams {
  homeUrl: string;
}

export interface UseMultiAuthProviderContextResult {
  contextValue: AuthContextType;
}

export function useMultiAuthProviderContext({
  homeUrl,
}: UseMultiAuthProviderContextParams): UseMultiAuthProviderContextResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentProvider, setCurrentProvider] = useState<AuthProviderType | null>(null);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info');
        }

        const userInfo = await userInfoResponse.json();

        const authUser: AuthUser = {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          provider: 'google',
          access_token: tokenResponse.access_token,
          expires_at: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        localStorage.setItem(PROVIDER_KEY, 'google');
        setUser(authUser);
        setCurrentProvider('google');

        const redirectUrl = localStorage.getItem(REDIRECT_URL_KEY);
        if (redirectUrl) {
          localStorage.removeItem(REDIRECT_URL_KEY);
          window.location.href = redirectUrl;
        }
      } catch (_error) {
        notify.error('Failed to process Google login. Please try again.');
      }
    },
    onError: () => {
      notify.error('Google login failed. Please try again.');
    },
    flow: 'implicit',
  });

  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    const storedProvider = localStorage.getItem(PROVIDER_KEY) as AuthProviderType | null;

    if (storedUser && storedProvider) {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        if (parsedUser.expires_at > Date.now()) {
          setUser(parsedUser);
          setCurrentProvider(storedProvider);
        } else {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(PROVIDER_KEY);
        }
      } catch (_error) {
        notify.error('Authentication data corrupted. Please sign in again.');
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PROVIDER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = useCallback(
    (options?: { returnUrl?: string; provider?: AuthProviderType }) => {
      const provider = options?.provider || 'google';

      const currentUrl = window.location.pathname + window.location.search;
      localStorage.setItem(REDIRECT_URL_KEY, options?.returnUrl || currentUrl);
      localStorage.setItem(PROVIDER_KEY, provider);

      if (provider === 'google') {
        googleLogin();
        return;
      }

      const config = getProviderConfig(provider, homeUrl);

      if (!config.clientId) {
        const providerName =
          provider === 'microsoft' ? 'Microsoft' : provider === 'github' ? 'GitHub' : provider;
        notify.error(
          `${providerName} Client ID is not configured. Please check your environment variables.`
        );
        return;
      }

      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scope,
        state: crypto.randomUUID(),
      });

      if (provider === 'microsoft') {
        params.append('response_mode', 'query');
        params.append('prompt', 'select_account');
      }

      window.location.href = `${config.authUrl}?${params.toString()}`;
    },
    [googleLogin, homeUrl]
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REDIRECT_URL_KEY);
    localStorage.removeItem(PROVIDER_KEY);
    setUser(null);
    setCurrentProvider(null);

    window.location.href = homeUrl;
  }, [homeUrl]);

  const getAccessToken = useCallback(() => {
    if (!user) return null;

    if (user.expires_at <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PROVIDER_KEY);
      setUser(null);
      setCurrentProvider(null);
      return null;
    }

    return user.access_token;
  }, [user]);

  const getIdToken = useCallback(() => {
    return user?.id_token || null;
  }, [user]);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      signIn,
      signOut,
      getAccessToken,
      getIdToken,
      currentProvider,
    }),
    [user, isLoading, signIn, signOut, getAccessToken, getIdToken, currentProvider]
  );

  return { contextValue };
}
