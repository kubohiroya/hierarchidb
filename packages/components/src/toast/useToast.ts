import { useContext, type ReactNode } from 'react';
import { ToastContext, type ToastConfig, type ToastContextType } from './ToastProvider.js';

/**
 * Hook to use toast functionality
 */
export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Convenience hooks for common toast types
 */
export function useToastNotifications() {
  const { showToast } = useToast();

  return {
    success: (message: ReactNode, options?: Partial<ToastConfig>) =>
      showToast({ ...options, message, severity: 'success' }),

    error: (message: ReactNode, options?: Partial<ToastConfig>) =>
      showToast({ ...options, message, severity: 'error' }),

    warning: (message: ReactNode, options?: Partial<ToastConfig>) =>
      showToast({ ...options, message, severity: 'warning' }),

    info: (message: ReactNode, options?: Partial<ToastConfig>) =>
      showToast({ ...options, message, severity: 'info' }),

    custom: (config: ToastConfig) => showToast(config),
  };
}
