import React from 'react';
import type { AuthContextType } from '~/types/AuthContextType';
import type { AuthProviderType } from '~/types/AuthProviderType';
import type { AuthUser } from '~/types/AuthUser';

interface UseSimpleBFFAuthProviderContextParams {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  signIn: (options?: {
    returnUrl?: string;
    method?: 'redirect' | 'popup';
    provider?: AuthProviderType;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => string | null;
  getIdToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
}

export function useSimpleBFFAuthHmrAccept() {
  React.useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept();
    }
  }, []);
}

export function useSimpleBFFAuthProviderContext({
  user,
  isLoading,
  isAuthenticating,
  signIn,
  signOut,
  getAccessToken,
  getIdToken,
  refreshAccessToken,
}: UseSimpleBFFAuthProviderContextParams) {
  const contextValue = React.useMemo<
    AuthContextType & { refreshAccessToken?: () => Promise<boolean> }
  >(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading: isLoading ? true : isAuthenticating,
      signIn,
      signOut,
      getAccessToken,
      getIdToken,
      currentProvider: user?.provider ?? null,
      refreshAccessToken,
    }),
    [
      user,
      isLoading,
      isAuthenticating,
      signIn,
      signOut,
      getAccessToken,
      getIdToken,
      refreshAccessToken,
    ],
  );

  React.useEffect(() => {
    (
      window as typeof window & { __ERIA_AUTH_CONTEXT__?: typeof contextValue }
    ).__ERIA_AUTH_CONTEXT__ = contextValue;
    return () => {
      delete (
        window as typeof window & {
          __ERIA_AUTH_CONTEXT__?: typeof contextValue;
        }
      ).__ERIA_AUTH_CONTEXT__;
    };
  }, [contextValue]);

  return contextValue;
}
