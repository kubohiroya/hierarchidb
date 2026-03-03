import { useCallback, useMemo } from 'react';
import type { AuthProviderType } from '~/types/AuthProviderType';
import { AuthProviderOptions } from './AuthProviderOptions.js';

type UseAuthProviderPromptViewArgs = {
  onSignIn: (provider?: AuthProviderType) => void;
};

export const useAuthProviderPromptView = ({ onSignIn }: UseAuthProviderPromptViewArgs) => {
  const availableProviders = useMemo(
    () => AuthProviderOptions.filter((provider) => provider.available),
    [],
  );

  const handleSignIn = useCallback((provider: AuthProviderType) => {
    onSignIn(provider);
  }, [onSignIn]);

  return {
    availableProviders,
    handleSignIn,
  };
};
