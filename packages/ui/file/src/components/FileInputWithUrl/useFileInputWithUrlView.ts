import { useCallback, useMemo, useState } from 'react';
import { devError, devLog } from '~/utils/logger';

interface UseFileInputWithUrlViewArgs {
  showUrlDownload: boolean;
  mode?: 'local' | 'url' | 'both';
  error?: string | null;
  localError?: string | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  signIn: (provider?: string) => void;
}

export const useFileInputWithUrlView = ({
  showUrlDownload,
  mode,
  error,
  localError,
  isAuthenticated,
  isLoadingAuth,
  signIn,
}: UseFileInputWithUrlViewArgs) => {
  const [hoveredSection, setHoveredSection] = useState<'drag' | 'url' | undefined>();
  const resolvedMode = mode ?? (showUrlDownload ? 'both' : 'local');
  const showLocalUpload = resolvedMode !== 'url';
  const showUrlDownloadSection = resolvedMode !== 'local';
  const displayError = error ?? localError ?? undefined;

  const handleSignIn = useCallback((provider?: string) => {
    devLog('FileInputWithUrl onSignIn:', {
      signIn,
      typeof: typeof signIn,
      provider,
    });
    if (typeof signIn === 'function') {
      signIn(provider);
      return;
    }
    devError('signIn is not a function:', signIn);
  }, [signIn]);

  const shouldShowAuthErrorAction = useMemo(
    () => Boolean(displayError?.includes('Authentication required') && !isAuthenticated),
    [displayError, isAuthenticated],
  );

  return {
    hoveredSection,
    setHoveredSection,
    showLocalUpload,
    showUrlDownloadSection,
    displayError,
    shouldShowAuthErrorAction,
    isLoadingAuth,
    handleSignIn,
  };
};
