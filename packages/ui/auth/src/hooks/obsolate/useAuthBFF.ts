import { useCallback } from 'react';
import { AuthProviderType } from '../../types/AuthProviderType';

// Temporary implementations for missing dependencies
interface BFFUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  access_token: string;
  expires_at?: number;
}

const useSimpleBFFAuth = () => ({
  isAuthenticated: false,
  isLoading: false,
  user: null as BFFUser | null,
  signIn: (_options?: any) => Promise.resolve(),
  signOut: () => Promise.resolve(),
  getIdToken: () => undefined,
  getAccessToken: () => undefined,
  currentProvider: 'google' as AuthProviderType,
});

const useAuthMethod = () => 'popup' as 'popup' | 'redirect';

export function useAuth() {
  const bffAuth = useSimpleBFFAuth();
  const authMethod = useAuthMethod();

  // Wrap signIn to include authMethod
  const signIn = useCallback(
    async (options?: { returnUrl?: string; isUserInitiated?: boolean; provider?: string }) => {
      return bffAuth.signIn({
        returnUrl: options?.returnUrl,
        method: authMethod,
        provider: options?.provider as AuthProviderType | undefined,
      });
    },
    [bffAuth, authMethod]
  );

  // Create auth object that matches the expected interface
  const auth = {
    isAuthenticated: bffAuth.isAuthenticated,
    isLoading: bffAuth.isLoading,
    user: bffAuth.user,
  };

  // Create user object that matches the expected interface
  const user = bffAuth.user
    ? {
        profile: {
          sub: bffAuth.user.id,
          email: bffAuth.user.email,
          name: bffAuth.user.name,
          picture: bffAuth.user.picture,
          preferred_username: bffAuth.user.email,
        },
        access_token: bffAuth.user.access_token,
        expires_at: bffAuth.user.expires_at ? bffAuth.user.expires_at / 1000 : undefined,
      }
    : null;

  return {
    auth,
    user,
    signIn,
    signOut: bffAuth.signOut,
    getIdToken: bffAuth.getIdToken,
    getAccessToken: bffAuth.getAccessToken,
    isAuthenticated: bffAuth.isAuthenticated,
    isLoading: bffAuth.isLoading,
    currentProvider: bffAuth.currentProvider,
  };
}

export function getIdToken(): string | undefined {
  // For BFF auth, we use the access token as the ID token
  const token = sessionStorage.getItem('access_token');
  return token || undefined;
}
