/**
 * @file useToast.ts
 * @description Toast notification hook for LinkButton
 */

import { useCallback, useState } from 'react';
import { ToastConfig } from './LinkButton';

/**
 * Default toast configurations
 */
const DEFAULT_TOAST_CONFIG: Partial<ToastConfig> = {
  severity: 'info',
  duration: 3000,
  enabled: true,
};

const DEFAULT_SUCCESS_TOAST: Partial<ToastConfig> = {
  ...DEFAULT_TOAST_CONFIG,
  severity: 'success',
};

const DEFAULT_ERROR_TOAST: Partial<ToastConfig> = {
  ...DEFAULT_TOAST_CONFIG,
  severity: 'error',
  duration: 5000, // Errors stay longer
};

/**
 * Toast notification state
 */
export interface ToastState {
  open: boolean;
  config: ToastConfig | null;
}

/**
 * Return type for useToast hook
 */
export interface UseToastReturn {
  toastState: ToastState;
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
  showSuccessToast: (message: string, config?: Partial<ToastConfig>) => void;
  showErrorToast: (message: string, config?: Partial<ToastConfig>) => void;
}

/**
 * Hook for managing toast notifications
 */
export function useToast(onToast?: (config: ToastConfig) => void): UseToastReturn {
  const [toastState, setToastState] = useState<ToastState>({
    open: false,
    config: null,
  });

  const showToast = useCallback(
    (config: ToastConfig) => {
      // Check if toast is enabled (default to true)
      if (config.enabled === false) {
        return;
      }

      // If external handler provided, use it
      if (onToast) {
        onToast(config);
        return;
      }

      // Otherwise, manage internally
      setToastState({
        open: true,
        config: {
          ...DEFAULT_TOAST_CONFIG,
          ...config,
        },
      });

      // Auto-hide after duration
      if (config.duration !== 0 && config.duration !== null) {
        setTimeout(
          () => {
            setToastState((prev) =>
              prev.config === config ? { open: false, config: null } : prev
            );
          },
          config.duration || DEFAULT_TOAST_CONFIG.duration || 3000
        );
      }
    },
    [onToast]
  );

  const hideToast = useCallback(() => {
    setToastState({
      open: false,
      config: null,
    });
  }, []);

  const showSuccessToast = useCallback(
    (message: string, config?: Partial<ToastConfig>) => {
      showToast({
        ...DEFAULT_SUCCESS_TOAST,
        ...config,
        message,
      } as ToastConfig);
    },
    [showToast]
  );

  const showErrorToast = useCallback(
    (message: string, config?: Partial<ToastConfig>) => {
      showToast({
        ...DEFAULT_ERROR_TOAST,
        ...config,
        message,
      } as ToastConfig);
    },
    [showToast]
  );

  return {
    toastState,
    showToast,
    hideToast,
    showSuccessToast,
    showErrorToast,
  };
}

/**
 * Helper to merge toast configurations
 */
export function mergeToastConfigs(
  base?: ToastConfig,
  override?: ToastConfig
): ToastConfig | undefined {
  if (!base && !override) return undefined;

  if (!base) return override;
  if (!override) return base;

  // If override explicitly disables, return undefined
  if (override.enabled === false) return undefined;

  return {
    ...base,
    ...override,
    // At this point, override.enabled is either true or undefined (not false)
    enabled: base.enabled !== false,
  };
}

/**
 * Helper to steps toast config from legacy props
 */
export function createToastFromLegacy(
  showSuccessMessage?: boolean,
  successMessage?: string,
  successToast?: ToastConfig
): ToastConfig | undefined {
  // Prefer new toast config
  if (successToast) {
    return successToast;
  }

  // Fallback to legacy props
  if (showSuccessMessage && successMessage) {
    return {
      enabled: true,
      message: successMessage,
      severity: 'success',
    };
  }

  return undefined;
}
