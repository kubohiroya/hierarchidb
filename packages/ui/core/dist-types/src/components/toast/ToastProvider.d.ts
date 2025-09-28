/**
 * @file ToastProvider.tsx
 * @description Customizable toast notification provider with hide/show functionality
 */
import { type ReactNode } from 'react';
import { type AlertColor } from '@mui/material';
/**
 * Toast notification configuration with enhanced customization
 */
export interface ToastConfig {
    /**
     * Whether to show the toast. If false, toast will not be displayed.
     * @default true
     */
    enabled?: boolean;
    /**
     * Message to display. Can be string or React component for rich content.
     */
    message: ReactNode;
    /**
     * Severity level affecting color and icon
     * @default 'info'
     */
    severity?: AlertColor;
    /**
     * Duration in milliseconds. If 0 or null, toast will not auto-hide.
     * @default 4000
     */
    duration?: number | null;
    /**
     * Custom action button
     */
    action?: {
        label: ReactNode;
        onClick: () => void;
        color?: 'inherit' | 'primary' | 'secondary';
        variant?: 'text' | 'outlined' | 'contained';
    };
    /**
     * Custom close button configuration
     */
    closable?: {
        enabled: boolean;
        label?: string;
    };
    /**
     * Position on screen
     * @default { vertical: 'bottom', horizontal: 'left' }
     */
    position?: {
        vertical: 'top' | 'bottom';
        horizontal: 'left' | 'center' | 'right';
    };
    /**
     * Custom styling
     */
    style?: {
        backgroundColor?: string;
        color?: string;
        borderRadius?: string | number;
        elevation?: number;
    };
    /**
     * Additional props to pass to Alert component
     */
    alertProps?: Record<string, unknown>;
    /**
     * Additional props to pass to Snackbar component
     */
    snackbarProps?: Record<string, unknown>;
    /**
     * Callback when toast is closed
     */
    onClose?: () => void;
    /**
     * Callback when toast is opened
     */
    onOpen?: () => void;
    /**
     * Unique ID for the toast (auto-output if not provided)
     */
    id?: string;
}
/**
 * Toast theme interface
 */
interface ToastContextType {
    showToast: (config: ToastConfig) => string;
    hideToast: (id?: string) => void;
    hideAllToasts: () => void;
    isVisible: (id: string) => boolean;
    updateToast: (id: string, updates: Partial<ToastConfig>) => void;
}
/**
 * Toast provider component props
 */
interface ToastProviderProps {
    children: ReactNode;
    /**
     * Maximum number of toasts to show simultaneously
     * @default 3
     */
    maxToasts?: number;
    /**
     * Default configuration for all toasts
     */
    defaultConfig?: Partial<ToastConfig>;
}
/**
 * Provider component for toast notifications
 */
export declare function ToastProvider({ children, maxToasts, defaultConfig, }: ToastProviderProps): JSX.Element;
/**
 * Hook to use toast functionality
 */
export declare function useToast(): ToastContextType;
/**
 * Convenience hooks for common toast types
 */
export declare function useToastNotifications(): {
    success: (message: ReactNode, options?: Partial<ToastConfig>) => string;
    error: (message: ReactNode, options?: Partial<ToastConfig>) => string;
    warning: (message: ReactNode, options?: Partial<ToastConfig>) => string;
    info: (message: ReactNode, options?: Partial<ToastConfig>) => string;
    custom: (config: ToastConfig) => string;
};
export {};
//# sourceMappingURL=ToastProvider.d.ts.map