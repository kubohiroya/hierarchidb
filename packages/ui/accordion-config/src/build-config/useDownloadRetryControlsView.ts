import { useCallback, useEffect, useMemo } from 'react';
import type { DownloadRetryConfig } from './DownloadRetryControls.js';

const RETRY_ATTEMPTS_MAX = 8;

export interface UseDownloadRetryControlsViewParams {
  baseRetryConfig: DownloadRetryConfig;
  onChange: (next: DownloadRetryConfig) => void;
}

export interface UseDownloadRetryControlsViewResult {
  retryAttemptsMax: number;
  retryAttemptsValue: number;
  updateTimeoutMs: (rawValue: string) => void;
  updateRetryDelay: (rawValue: string) => void;
  updateRetryAttempts: (value: number | null) => void;
  updateRetryBackoff: (value: DownloadRetryConfig['retryBackoff']) => void;
}

export function useDownloadRetryControlsView({
  baseRetryConfig,
  onChange,
}: UseDownloadRetryControlsViewParams): UseDownloadRetryControlsViewResult {
  const retryAttemptsValue = useMemo(
    () => Math.min(baseRetryConfig.retryAttempts, RETRY_ATTEMPTS_MAX),
    [baseRetryConfig.retryAttempts],
  );

  useEffect(() => {
    if (baseRetryConfig.retryLimit === retryAttemptsValue) return;
    onChange({
      ...baseRetryConfig,
      retryLimit: retryAttemptsValue,
    });
  }, [baseRetryConfig, onChange, retryAttemptsValue]);

  const updateTimeoutMs = useCallback((rawValue: string) => {
    const timeoutMs = Number(rawValue);
    onChange({
      ...baseRetryConfig,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : baseRetryConfig.timeoutMs,
    });
  }, [baseRetryConfig, onChange]);

  const updateRetryDelay = useCallback((rawValue: string) => {
    const retryDelay = Number(rawValue);
    onChange({
      ...baseRetryConfig,
      retryDelay: Number.isFinite(retryDelay) ? retryDelay : baseRetryConfig.retryDelay,
    });
  }, [baseRetryConfig, onChange]);

  const updateRetryAttempts = useCallback((value: number | null) => {
    const nextValue = value === null ? retryAttemptsValue : value;
    const retryAttempts = Math.min(nextValue, RETRY_ATTEMPTS_MAX);
    const retryLimit = Math.min(baseRetryConfig.retryLimit, retryAttempts);
    onChange({
      ...baseRetryConfig,
      retryAttempts,
      retryLimit,
    });
  }, [baseRetryConfig, onChange, retryAttemptsValue]);

  const updateRetryBackoff = useCallback((value: DownloadRetryConfig['retryBackoff']) => {
    onChange({
      ...baseRetryConfig,
      retryBackoff: value,
    });
  }, [baseRetryConfig, onChange]);

  return {
    retryAttemptsMax: RETRY_ATTEMPTS_MAX,
    retryAttemptsValue,
    updateTimeoutMs,
    updateRetryDelay,
    updateRetryAttempts,
    updateRetryBackoff,
  };
}
