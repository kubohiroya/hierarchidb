import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadFile } from '../../../services/UnifiedDownloadService';
// import { convertCorsProxyURL } from "@/domains/resources/_shapes_buggy/batch/utils/convertCorsProxyUrl";
// import { useAuth } from "@/shared/auth";
import { devLog } from '../../../utils/logger';
import { validateExternalURL } from '../../../utils/validation';
export function useUrlDownload({
  disabled,
  loading,
  defaultDownloadUrl,
  handleFileSelect,
  handleUrlDownload,
  onDownloadProgress,
}) {
  // const { user, signIn, isAuthenticated, isLoading } = useAuth();
  const user = null;
  const signIn = () => {};
  const isAuthenticated = false;
  const isLoading = false;
  const isLoadingAuth = isLoading ?? false;
  const retryCountRef = useRef(0);
  const abortControllerRef = useRef(null);
  // Check if we have a valid access token
  const hasValidToken = !!(user?.access_token || sessionStorage.getItem('access_token'));
  // Simply use the defaultDownloadUrl without sessionStorage
  const [downloadUrl, setDownloadUrl] = useState(defaultDownloadUrl || '');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState();
  const [downloadProgress, setDownloadProgress] = useState();
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);
  // Store auth error state in ref to avoid stale closure
  const wasAuthErrorRef = useRef(false);
  // Reset auth error when user becomes authenticated
  const shouldResetAuthError = isAuthenticated && wasAuthErrorRef.current;

  useEffect(() => {
    if (!shouldResetAuthError) return;
    setIsAuthError(false);
    setDownloadError(undefined);
    wasAuthErrorRef.current = false;
  }, [shouldResetAuthError]);

  useEffect(() => {
    if (isAuthError && !wasAuthErrorRef.current) {
      wasAuthErrorRef.current = true;
    }
  }, [isAuthError]);

  const setDownloadUrlState = useCallback((url) => {
    setDownloadUrl(url);
    setDownloadSuccess(false);
  }, []);

  // Update downloadUrl when defaultDownloadUrl changes and there's no user-entered URL
  useEffect(() => {
    if (defaultDownloadUrl && (!downloadUrl || downloadUrl.trim() === '')) {
      setDownloadUrlState(defaultDownloadUrl);
    }
  }, [defaultDownloadUrl, downloadUrl, setDownloadUrlState]);
  // RemovedProperties downloadWithProgress - now handled by UnifiedDownloadService
  const handleDownload = useCallback(async () => {
    if (!downloadUrl.trim() || isDownloading || loading || disabled) {
      return;
    }
    setIsDownloading(true);
    setDownloadError(undefined);
    setIsAuthError(false);
    setDownloadProgress(undefined);
    setDownloadSuccess(false);
    try {
      // Check if the URL looks like a JWT token (starts with "eyJ")
      const trimmedUrl = downloadUrl.trim();
      if (trimmedUrl.startsWith('eyJ')) {
        throw new Error('Invalid URL format. Please enter a valid HTTP(S) URL.');
      }
      // If a custom URL download handler is provided, use it
      if (handleUrlDownload) {
        await handleUrlDownload(trimmedUrl);
        setDownloadSuccess(true);
        return;
      }
      // Check if authentication is required but user is not authenticated
      const validationResult = validateExternalURL(trimmedUrl);
      if (!validationResult.valid) {
        throw new Error(validationResult.error || 'Invalid URL');
      }
      const validatedUrl = validationResult.url || trimmedUrl;
      const needsCorsProxy = !validatedUrl.startsWith(window.location.origin || '');
      let corsProxyBaseURL = '';
      try {
        // Vite-style env where available
        // eslint-disable-next-line no-undef
        corsProxyBaseURL =
          (import.meta && import.meta.env && import.meta.env.VITE_CORS_PROXY_BASE_URL) || '';
      } catch {}
      if (needsCorsProxy && corsProxyBaseURL && !hasValidToken) {
        setIsAuthError(true);
        throw new Error(
          'Authentication required. Please sign in to download data from external sources.'
        );
      }
      // Create abort controller for this download
      abortControllerRef.current = new AbortController();
      // Use shared download helper for optimized download
      const blob = await downloadFile(validatedUrl, {
        onProgress: (progress) => {
          setDownloadProgress(progress);
          onDownloadProgress?.(progress);
        },
        signal: abortControllerRef.current.signal,
      });
      // Create a file from the blob
      const filename = trimmedUrl.split('/').pop() || 'download';
      const file = new File([blob], filename, { type: blob.type });
      // Create final file
      const finalFile = file;
      /*
 if (downloadInfo?.deduplicationInfo?.wasDeduped) {
 devLog(
 ` Content deduplication saved ${downloadInfo.deduplicationInfo.savedBytes} bytes`,
 );
 }
*/
      // Process the file with the original URL
      await handleFileSelect(finalFile, validatedUrl);
      setDownloadSuccess(true);
      // Reset retry count on success
      retryCountRef.current = 0;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Handle authentication errors specifically
      if (errorMessage.includes('Authentication') || errorMessage.includes('401')) {
        // Try to refresh token once before giving up
        if (retryCountRef.current === 0) {
          devLog('Received auth error, attempting token refresh...');
          retryCountRef.current++;
          try {
            const authContext = window.__ERIA_AUTH_CONTEXT__;
            if (authContext?.refreshAccessToken) {
              const refreshed = await authContext.refreshAccessToken();
              if (refreshed) {
                // Retry the download
                await handleDownload();
                return;
              }
            }
          } catch (refreshError) {
            devLog('Token refresh failed:', refreshError);
          }
        }
        setIsAuthError(true);
        setDownloadError(
          'Authentication failed. Please sign in again to download data from external sources.'
        );
      } else {
        setDownloadError(errorMessage);
      }
      setDownloadSuccess(false);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(undefined);
      onDownloadProgress?.(undefined);
    }
  }, [
    downloadUrl,
    handleFileSelect,
    isDownloading,
    loading,
    disabled,
    handleUrlDownload,
    onDownloadProgress,
    hasValidToken,
  ]);
  const handleKeyPress = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleDownload();
      }
    },
    [handleDownload]
  );
  // Reset auth error state when user becomes authenticated
  // But do NOT auto-retry - user must click download button again
  useEffect(() => {
    if (!shouldResetAuthError) return;
    wasAuthErrorRef.current = false;
    setIsAuthError(false);
    // Clear the error but don't auto-retry
    setDownloadError(undefined);
    // User must manually click download again
  }, [shouldResetAuthError]);
  // Wrap signIn to accept provider parameter
  const handleSignIn = (_provider) => {
    // Mock sign in - do nothing since auth is not available
    signIn();
  };
  return {
    downloadUrl,
    setDownloadUrl: setDownloadUrlState,
    isDownloading,
    downloadError,
    downloadProgress,
    downloadSuccess,
    isAuthError,
    handleDownload,
    handleKeyPress,
    isAuthenticated,
    isLoadingAuth,
    signIn: handleSignIn,
  };
}
//# sourceMappingURL=useUrlDownload.js.map
