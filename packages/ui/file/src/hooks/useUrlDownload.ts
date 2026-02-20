import { validateExternalURL } from '@hierarchidb/util';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadFile } from '~/services/UnifiedDownloadService';
import { devError, devLog } from '~/utils/logger';

interface UrlDownloadAuth {
  accessToken?: string;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  signIn?: (provider?: string) => void;
}

export interface UseUrlDownloadOptions {
  accept: string;
  disabled: boolean;
  loading: boolean;
  defaultDownloadUrl?: string;
  handleFileSelect: (file: File, downloadUrl?: string) => void | Promise<void>;
  handleUrlDownload?: (url: string) => Promise<void>;
  onDownloadProgress?: (progress: number | undefined) => void;
  auth?: UrlDownloadAuth;
}

export interface UseUrlDownloadResult {
  downloadUrl: string;
  setDownloadUrl: (url: string) => void;
  isDownloading: boolean;
  downloadError: string | undefined;
  downloadProgress: number | undefined;
  downloadSuccess: boolean;
  isAuthError: boolean;
  handleDownload: () => Promise<void>;
  handleKeyPress: (event: KeyboardEvent) => void;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  signIn: (provider?: string) => void;
}

const getCorsProxyBaseURL = (): string | undefined => {
  const viteEnv = (import.meta as ImportMeta & { env?: { VITE_CORS_PROXY_BASE_URL?: string } }).env;
  if (
    typeof viteEnv?.VITE_CORS_PROXY_BASE_URL === 'string' &&
    viteEnv.VITE_CORS_PROXY_BASE_URL.length > 0
  ) {
    return viteEnv.VITE_CORS_PROXY_BASE_URL;
  }

  const globalProcess =
    typeof globalThis === 'object' && globalThis !== null && 'process' in globalThis
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      : undefined;

  const fromProcess = globalProcess?.env?.VITE_CORS_PROXY_BASE_URL;
  if (typeof fromProcess === 'string' && fromProcess.length > 0) {
    return fromProcess;
  }

  return undefined;
};

export function useUrlDownload({
  accept,
  disabled,
  loading,
  defaultDownloadUrl,
  handleFileSelect,
  handleUrlDownload,
  onDownloadProgress,
  auth,
}: UseUrlDownloadOptions): UseUrlDownloadResult {
  const {
    accessToken,
    isAuthenticated: authState = false,
    isLoading: authLoading = false,
    signIn: signInFn,
  } = auth ?? {};

  const signIn = signInFn ?? (() => {});
  const isAuthenticated = authState;
  const isLoadingAuth = authLoading ?? false;

  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasValidToken = !!(accessToken || localStorage.getItem('access_token'));

  const [downloadUrl, setDownloadUrl] = useState(defaultDownloadUrl || '');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | undefined>();
  const [downloadProgress, setDownloadProgress] = useState<number | undefined>();
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);

  const wasAuthErrorRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && wasAuthErrorRef.current) {
      setIsAuthError(false);
      setDownloadError(undefined);
      wasAuthErrorRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthError && !wasAuthErrorRef.current) {
      wasAuthErrorRef.current = true;
    }
  }, [isAuthError]);

  const setDownloadUrlState = useCallback((url: string) => {
    setDownloadUrl(url);
    setDownloadSuccess(false);
  }, []);

  useEffect(() => {
    if (defaultDownloadUrl && (!downloadUrl || downloadUrl.trim() === '')) {
      setDownloadUrlState(defaultDownloadUrl);
    }
  }, [defaultDownloadUrl, downloadUrl, setDownloadUrlState]);

  const guessExtensionFromContentType = useCallback((contentType: string | undefined): string => {
    if (!contentType) return '';

    if (contentType.includes('csv')) return '.csv';
    if (contentType.includes('excel') || contentType.includes('spreadsheet-plugin')) return '.xlsx';
    if (contentType.includes('zip')) return '.zip';
    if (contentType.includes('json')) return '.json';
    if (contentType.includes('xml')) return '.xml';

    return '';
  }, []);

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
    [accept, guessExtensionFromContentType]
  );

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
      const trimmedUrl = downloadUrl.trim();
      if (trimmedUrl.startsWith('eyJ')) {
        throw new Error('Invalid URL format. Please enter a valid HTTP(S) URL.');
      }

      if (handleUrlDownload) {
        await handleUrlDownload(trimmedUrl);
        setDownloadSuccess(true);
        return;
      }

      const validationResult = validateExternalURL(trimmedUrl);
      if (!validationResult.valid) {
        throw new Error(validationResult.error || 'Invalid URL');
      }
      const validatedUrl = validationResult.url || trimmedUrl;
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const needsCorsProxy = origin ? !validatedUrl.startsWith(origin) : true;
      const corsProxyBaseURL = getCorsProxyBaseURL();

      if (needsCorsProxy && corsProxyBaseURL && !hasValidToken) {
        setIsAuthError(true);
        throw new Error(
          'Authentication required. Please sign in to download data from external sources.'
        );
      }

      abortControllerRef.current = new AbortController();

      const blob = await downloadFile(validatedUrl, {
        onProgress: (progress) => {
          setDownloadProgress(progress);
          onDownloadProgress?.(progress);
        },
        signal: abortControllerRef.current.signal,
      });

      const fileNameFromUrl = validatedUrl.split('?')[0]?.split('/').pop() || 'download';
      const safeFilename = validateFileType(fileNameFromUrl, blob.type);
      const file = new File([blob], safeFilename, { type: blob.type || undefined });
      await handleFileSelect(file, validatedUrl);

      setDownloadSuccess(true);
      setDownloadError(undefined);
      retryCountRef.current = 0;
    } catch (error) {
      devError('[useUrlDownload] download failed', error);
      setDownloadSuccess(false);

      if (error instanceof DOMException && error.name === 'AbortError') {
        setDownloadError('Download cancelled.');
        return;
      }

      const message = error instanceof Error ? error.message : 'Failed to download file.';
      setDownloadError(message);

      if (message.includes('Authentication required')) {
        setIsAuthError(true);
      } else {
        retryCountRef.current += 1;
        if (retryCountRef.current <= 1) {
          devLog('[useUrlDownload] retrying download after failure');
          await handleDownload();
        }
      }
    } finally {
      setIsDownloading(false);
      setDownloadProgress(undefined);
      onDownloadProgress?.(undefined);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }
  }, [
    disabled,
    downloadUrl,
    handleFileSelect,
    handleUrlDownload,
    hasValidToken,
    isDownloading,
    loading,
    onDownloadProgress,
    validateFileType,
  ]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    []
  );

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void handleDownload();
      }
    },
    [handleDownload]
  );
  const handleSignIn = (provider?: string) => {
    signIn(provider);
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
