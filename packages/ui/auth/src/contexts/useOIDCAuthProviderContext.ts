import { useAuth } from 'react-oidc-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthContextType } from '~/types/AuthContextType';
import type { AuthUser } from '~/types/AuthUser';

const STORAGE_KEY = 'oidc-auth-user';
const REDIRECT_URL_KEY = 'oidc-auth-redirect';
const isSafeRedirectPath = (value: string): boolean =>
  value.startsWith('/') && !value.startsWith('//');

const notify = {
  error: (msg: string) => console.error(msg),
};

export interface UseOIDCAuthProviderContextParams {
  fallbackPath: string;
}

export interface UseOIDCAuthProviderContextResult {
  contextValue: AuthContextType;
}

export function useOIDCAuthProviderContext({
  fallbackPath,
}: UseOIDCAuthProviderContextParams): UseOIDCAuthProviderContextResult {
  const auth = useAuth();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const authUser: AuthUser = {
        id: auth.user.profile.sub || '',
        email: auth.user.profile.email || '',
        name: auth.user.profile.name || '',
        picture: auth.user.profile.picture,
        provider: 'google',
        access_token: auth.user.access_token || '',
        id_token: auth.user.id_token,
        expires_at: (auth.user.expires_at || 0) * 1000,
      };

      setUser(authUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    } else {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
    }

    setIsLoading(auth.isLoading);
  }, [auth.isAuthenticated, auth.user, auth.isLoading]);

  useEffect(() => {
    if (auth.error) {
      if (import.meta.env.DEV) {
        console.error(`OIDC Authentication error:${auth.error}`);
      }
      notify.error('Authentication failed. Please try again.');
    }
  }, [auth.error]);

  const signIn = useCallback(
    (options?: { returnUrl?: string }) => {
      if (options?.returnUrl) {
        localStorage.setItem(REDIRECT_URL_KEY, options.returnUrl);
      } else {
        const currentUrl = window.location.pathname + window.location.search;
        localStorage.setItem(REDIRECT_URL_KEY, currentUrl);
      }

      auth.signinRedirect();
    },
    [auth]
  );

  const signOut = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REDIRECT_URL_KEY);
    setUser(null);

    try {
      await auth.signoutRedirect();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`Logout error: ${error}`);
      }
      window.location.href = fallbackPath;
    }
  }, [auth, fallbackPath]);

  const getAccessToken = useCallback(() => {
    if (!user || !auth.user) return null;

    const now = Date.now() / 1000;
    if ((auth.user.expires_at || 0) <= now) {
      return null;
    }

    return user.access_token;
  }, [user, auth.user]);

  const getIdToken = useCallback(() => {
    return user?.id_token || null;
  }, [user]);

  useEffect(() => {
    if (auth.isAuthenticated && user) {
      const redirectUrl = localStorage.getItem(REDIRECT_URL_KEY);
      if (redirectUrl) {
        localStorage.removeItem(REDIRECT_URL_KEY);
        window.location.href = isSafeRedirectPath(redirectUrl) ? redirectUrl : fallbackPath;
      }
    }
  }, [auth.isAuthenticated, user]);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: auth.isAuthenticated,
      isLoading,
      signIn,
      signOut,
      getAccessToken,
      getIdToken,
      currentProvider: 'google',
    }),
    [user, auth.isAuthenticated, isLoading, signIn, signOut, getAccessToken, getIdToken]
  );

  return { contextValue };
}
