import { useMemo } from 'react';
import type { User } from 'oidc-client-ts';
import type { AuthContextProps } from 'react-oidc-context';

type AuthPanelState =
  | { kind: 'navigator'; message: string }
  | { kind: 'loading'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'authenticated'; email?: string }
  | { kind: 'unauthenticated' };

interface UseAuthPanelViewArgs {
  auth: AuthContextProps;
}

const getEmail = (user?: User | null): string | undefined => {
  const value = user?.profile?.email;
  return typeof value === 'string' ? value : undefined;
};

export const useAuthPanelView = ({ auth }: UseAuthPanelViewArgs): AuthPanelState => {
  return useMemo(() => {
    switch (auth.activeNavigator) {
      case 'signinSilent':
        return { kind: 'navigator', message: 'Signing you in...' };
      case 'signoutRedirect':
        return { kind: 'navigator', message: 'Signing you out...' };
      default:
        break;
    }

    if (auth.isLoading) {
      return { kind: 'loading', message: 'Loading...' };
    }

    if (auth.error) {
      return { kind: 'error', message: `Oops... ${auth.error.name} caused ${auth.error.message}` };
    }

    if (auth.isAuthenticated) {
      return { kind: 'authenticated', email: getEmail(auth.user) };
    }

    return { kind: 'unauthenticated' };
  }, [auth]);
};
