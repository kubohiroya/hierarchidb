/**
 * @file NotificationSystem.tsx
 * @description Unified notification system that replaces MUI Snackbar, Dialog alerts, and window.alert
 * with an accessible, consistent notification experience
 * @module components/ui/NotificationSystem
 */
export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';
export interface Notification {
    id: string;
    message: string;
    severity: NotificationSeverity;
    duration?: number | null;
    action?: {
        label: string;
        onClick: () => void;
    };
}
/**
 * Global function to show a notification
 * @param message - The notification message
 * @param severity - The severity level
 * @param options - Additional options
 */
export declare function showNotification(message: string, severity?: NotificationSeverity, options?: {
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}): void;
/**
 * Convenience functions for different severity levels
 */
export declare const notify: {
    success: (message: string, options?: Parameters<typeof showNotification>[2]) => void;
    info: (message: string, options?: Parameters<typeof showNotification>[2]) => void;
    warning: (message: string, options?: Parameters<typeof showNotification>[2]) => void;
    error: (message: string, options?: Parameters<typeof showNotification>[2]) => void;
};
/**
 * Replace window.alert with accessible notification
 */
export declare function replaceWindowAlert(): void;
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
export declare function NotificationSystem(): JSX.Element | null;
//# sourceMappingURL=NotificationSystem.d.ts.map