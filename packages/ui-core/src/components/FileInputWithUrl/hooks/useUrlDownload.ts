import { useCallback, useEffect, useRef, useState } from 'react';
import { validateExternalURL } from '@/shared/utils/validation';
// import { convertCorsProxyURL } from "@/domains/resources/shapes/batch/utils/convertCorsProxyUrl";
import { useAuth } from '@/shared/auth';
// import { devLog } from "@/shared/utils/logger";
import { UnifiedDownloadService } from '@/shared/services/UnifiedDownloadService';

interface UseUrlDownloadProps {
  accept: string;
  disabled: boolean;
  loading: boolean;
  defaultDownloadUrl?: string;
  handleFileSelect: (file: File, downloadUrl?: string) => void | Promise<void>;
  handleUrlDownload?: (url: string) => Promise<void>;
  onDownloadProgress?: (progress: number | undefined) => void;
}

interface UseUrlDownloadReturn {
  downloadUrl: string;
  setDownloadUrl: (url: string) => void;
  isDownloading: boolean;
  downloadError: string | undefined;
  downloadProgress: number | undefined;
  downloadSuccess: boolean;
  isAuthError: boolean;
  handleDownload: () => Promise<void>;
  handleKeyPress: (event: React.KeyboardEvent) => void;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  signIn: (provider?: string) => void;
}

export function useUrlDownload({
  accept,
  disabled,
  loading,
  defaultDownloadUrl,
  handleFileSelect,
  handleUrlDownload,
  onDownloadProgress,
}: UseUrlDownloadProps): UseUrlDownloadReturn {
  const { user, signIn, isAuthenticated, isLoading } = useAuth();
  const isLoadingAuth = isLoading ?? false;
  const retryCountRef = useRef(0);

  // Check if we have a valid access token
  const hasValidToken = !!(user?.access_token || sessionStorage.getItem('access_token'));

  // Simply use the defaultDownloadUrl without sessionStorage
  const [downloadUrl, setDownloadUrl] = useState(defaultDownloadUrl || '');

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | undefined>();
  const [downloadProgress, setDownloadProgress] = useState<number | undefined>();
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);

  // Store auth error state in ref to avoid stale closure
  const wasAuthErrorRef = useRef(false);

  // Reset auth error when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && wasAuthErrorRef.current) {
      setIsAuthError(false);
      setDownloadError(undefined);
      wasAuthErrorRef.current = false;
    } else if (isAuthError && !wasAuthErrorRef.current) {
      wasAuthErrorRef.current = true;
    }
  }, [isAuthenticated, isAuthError]);

  // Update downloadUrl when defaultDownloadUrl changes and there's no user-entered URL
  useEffect(() => {
    if (defaultDownloadUrl && (!downloadUrl || downloadUrl.trim() === '')) {
      setDownloadUrl(defaultDownloadUrl);
    }
  }, [defaultDownloadUrl, downloadUrl]);

  // Reset download success when URL changes
  useEffect(() => {
    setDownloadSuccess(false);
  }, [downloadUrl]);

  const guessExtensionFromContentType = (contentType: string | undefined): string => {
    if (!contentType) return '';

    if (contentType.includes('csv')) return '.csv';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '.xlsx';
    if (contentType.includes('zip')) return '.zip';
    if (contentType.includes('json')) return '.json';
    if (contentType.includes('xml')) return '.xml';

    return '';
  };

  const validateFileType = useCallback(
    (filename: string, contentType: string | undefined): string => {
      if (accept === '*') return filename;

      const acceptedExtensions = accept
        .split(',')
        .map((ext) => ext.trim().toLowerCase())
        .filter((ext) => ext.startsWith('.'));

      const hasValidExtension = acceptedExtensions.some((ext) =>
        filename.toLowerCase().endsWith(ext)
      );

      if (!hasValidExtension) {
        const guessedExtension = guessExtensionFromContentType(contentType);

        if (guessedExtension && acceptedExtensions.includes(guessedExtension)) {
          return filename + guessedExtension;
        }

        throw new Error(
          `Unable to determine file type or unsupported file type. Please ensure the URL points to one of: ${acceptedExtensions.join(', ')}`
        );
      }

      return filename;
    },
    [accept]
  );

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
      const validatedUrl = validateExternalURL(trimmedUrl);
      const needsCorsProxy = !validatedUrl.startsWith(window.location.origin || '');
      const corsProxyBaseURL = import.meta.env.VITE_CORS_PROXY_BASE_URL;

      if (needsCorsProxy && corsProxyBaseURL && !hasValidToken) {
        setIsAuthError(true);
        throw new Error(
          'Authentication required. Please sign in to download data from external sources.'
        );
      }

      // Use UnifiedDownloadService for optimized download
      const { file, downloadInfo } = await UnifiedDownloadService.downloadAsFile(trimmedUrl, {
        corsProxyBaseURL: needsCorsProxy && corsProxyBaseURL ? corsProxyBaseURL : undefined,
        headers:
          needsCorsProxy && hasValidToken
            ? {
                Authorization: `Bearer ${user?.access_token || sessionStorage.getItem('access_token')}`,
              }
            : undefined,
        onProgress: (progress) => {
          setDownloadProgress(progress);
          if (onDownloadProgress) {
            onDownloadProgress(progress);
          }
        },
        enableContentOptimization: true,
      });

      // Validate file type
      const filename = validateFileType(file.name, file.type);

      // Create new file with validated filename if different
      const finalFile =
        filename !== file.name ? new File([file], filename, { type: file.type }) : file;

      // Log optimization results
      if (downloadInfo.fromCache) {
        // devLog("✓ Used cached content for download");
      }
      if (downloadInfo.deduplicationInfo?.wasDeduped) {
        // devLog("✓ Content deduplication saved...");
      }

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
          console.warn('Received auth error, attempting token refresh...');
          retryCountRef.current++;

          try {
            const authContext = (
              window as typeof window & {
                __ERIA_AUTH_CONTEXT__?: {
                  refreshAccessToken?: () => Promise<boolean>;
                };
              }
            ).__ERIA_AUTH_CONTEXT__;

            if (authContext?.refreshAccessToken) {
              const refreshed = await authContext.refreshAccessToken();
              if (refreshed) {
                // Retry the download
                await handleDownload();
                return;
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
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
      if (onDownloadProgress) {
        onDownloadProgress(undefined);
      }
    }
  }, [
    downloadUrl,
    handleFileSelect,
    user,
    isDownloading,
    loading,
    disabled,
    handleUrlDownload,
    onDownloadProgress,
    validateFileType,
    hasValidToken,
  ]);

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
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
    if (isAuthenticated && wasAuthErrorRef.current) {
      wasAuthErrorRef.current = false;
      setIsAuthError(false);
      // Clear the error but don't auto-retry
      setDownloadError(undefined);
      // User must manually click download again
    }
  }, [isAuthenticated]);

  // Wrap signIn to accept provider parameter
  const handleSignIn = useCallback(
    (provider?: string) => {
      if (provider) {
        signIn({ provider });
      } else {
        signIn();
      }
    },
    [signIn]
  );

  return {
    downloadUrl,
    setDownloadUrl,
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
