import { useId, useMemo } from 'react';

interface UseUrlDownloadSectionViewArgs {
  downloadUrl: string;
  downloadSuccess: boolean;
  isDownloading: boolean;
  downloadError: string | undefined;
  disabled: boolean;
  loading: boolean;
  isAuthError: boolean;
  isAuthenticated: boolean;
}

export const useUrlDownloadSectionView = ({
  downloadUrl,
  downloadSuccess,
  isDownloading,
  downloadError,
  disabled,
  loading,
  isAuthError,
  isAuthenticated,
}: UseUrlDownloadSectionViewArgs) => {
  const controlId = useId();
  const urlInputId = `${controlId}-download-url`;
  const hasUrlNotDownloaded = Boolean(
    downloadUrl.trim() && !downloadSuccess && !isDownloading && !downloadError
  );

  const downloadBlockedByAuth = Boolean(
    (isAuthError && !isAuthenticated) ||
      (downloadError?.includes('Authentication required') && !isAuthenticated)
  );

  const isDownloadDisabled = useMemo(
    () => !downloadUrl.trim() || disabled || loading || isDownloading || downloadBlockedByAuth,
    [disabled, downloadBlockedByAuth, downloadUrl, isDownloading, loading]
  );

  return {
    urlInputId,
    hasUrlNotDownloaded,
    isDownloadDisabled,
  };
};
