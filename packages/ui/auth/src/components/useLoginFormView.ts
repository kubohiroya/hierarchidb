import { useCallback, useState } from 'react';
import type { AuthProviderType } from '~/types/AuthProviderType';

interface UseLoginFormViewArgs {
  onLogin?: (provider: string, turnstileToken: string) => void;
}

interface UseLoginFormViewResult {
  error: string | null;
  loading: boolean;
  handleProviderClick: (provider: AuthProviderType) => Promise<void>;
}

export const useLoginFormView = ({ onLogin }: UseLoginFormViewArgs): UseLoginFormViewResult => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleProviderClick = useCallback(
    async (provider: AuthProviderType) => {
      setError(null);
      setLoading(true);

      try {
        const turnstileToken = 'dummy-token';
        if (onLogin) {
          await onLogin(provider, turnstileToken);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      } finally {
        setLoading(false);
      }
    },
    [onLogin]
  );

  return {
    error,
    loading,
    handleProviderClick,
  };
};
