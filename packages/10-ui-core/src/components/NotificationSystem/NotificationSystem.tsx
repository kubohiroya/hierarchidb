/**
 * @file NotificationSystem.tsx
 * @description Unified notification system that replaces MUI Snackbar, Dialog alerts, and window.alert
 * with an accessible, consistent notification experience
 * @module components/ui/NotificationSystem
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, IconButton, Slide, Snackbar, Stack } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { announceToScreenReader } from '~/components/AriaLiveRegion/AriaLiveRegion';

export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';

export interface Notification {
  id: string;
  message: string;
  severity: NotificationSeverity;
  duration?: number | null; // milliseconds, null for persistent
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationSystemState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

// Global state management
let globalState: NotificationSystemState | null = null;
const listeners = new Set<() => void>();

/**
 * Global function to show a notification
 * @param message - The notification message
 * @param severity - The severity level
 * @param options - Additional options
 */
export function showNotification(
  message: string,
  severity: NotificationSeverity = 'info',
  options?: {
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  }
) {
  if (globalState) {
    globalState.addNotification({
      message,
      severity,
      duration:
        options?.duration !== undefined ? options.duration : severity === 'error' ? null : 6000,
      action: options?.action,
    });
  }

  // Also announce to screen reader
  const ariaMode = severity === 'error' ? 'assertive' : 'polite';
  announceToScreenReader(message, ariaMode);
}

/**
 * Convenience functions for different severity levels
 */
export const notify = {
  success: (message: string, options?: Parameters<typeof showNotification>[2]) =>
    showNotification(message, 'success', options),
  info: (message: string, options?: Parameters<typeof showNotification>[2]) =>
    showNotification(message, 'info', options),
  warning: (message: string, options?: Parameters<typeof showNotification>[2]) =>
    showNotification(message, 'warning', options),
  error: (message: string, options?: Parameters<typeof showNotification>[2]) =>
    showNotification(message, 'error', options),
};

/**
 * Replace window.alert with accessible notification
 */
export function replaceWindowAlert() {
  if (typeof window !== 'undefined') {
    window.alert = (message: string) => {
      showNotification(message, 'warning');
    };
  }
}

// Slide transition is provided directly to TransitionComponent prop

/**
 * NotificationSystem component that displays stacked notifications
 *
 * @example
 * ```tsx
 * // Add to your src root
 * <NotificationSystem />
 *
 * // Use from anywhere in your src
 * import { notify } from '@/shared/containers/ui/NotificationSystem';
 *
 * notify.success('File uploaded successfully');
 * notify.error('Failed to save changes', { duration: null }); // Persistent
 * notify.info('Processing...', {
 *   action: {
 *     label: 'Cancel',
 *     onClick: () => cancelProcess()
 *   }
 * });
 * ```
 */
export function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [, forceUpdate] = useState({});

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newNotification: Notification = { ...notification, id };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-remove after duration
    if (notification.duration !== null && notification.duration !== undefined) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, notification.duration || 6000);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Set up global state
  useEffect(() => {
    globalState = {
      notifications,
      addNotification,
      removeNotification,
      clearAll,
    };

    const listener = () => forceUpdate({});
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, [notifications, addNotification, removeNotification, clearAll]);

  // Replace window.alert on mount
  useEffect(() => {
    replaceWindowAlert();
  }, []);

  return (
    <Stack
      spacing={1}
      sx={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        maxWidth: '90vw',
        width: 600,
      }}
    >
      {notifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.duration === null ? undefined : notification.duration}
          onClose={() => removeNotification(notification.id)}
          TransitionComponent={Slide}
          TransitionProps={{ direction: 'up' } as React.ComponentProps<typeof Slide>}
          sx={{ position: 'relative', bottom: 'auto', left: 'auto', right: 'auto' }}
        >
          <Alert
            severity={notification.severity}
            sx={{ width: '100%' }}
            action={
              <>
                {notification.action && (
                  <IconButton
                    size="small"
                    aria-label={notification.action.label}
                    color="inherit"
                    onClick={() => {
                      notification.action?.onClick();
                      removeNotification(notification.id);
                    }}
                  >
                    {notification.action.label}
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  aria-label="close notification"
                  color="inherit"
                  onClick={() => removeNotification(notification.id)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </>
            }
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </Stack>
  );
}
