/**
 * @file ToastProvider.tsx
 * @description Customizable toast notification provider with hide/show functionality
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  Alert,
  AlertColor,
  Box,
  Button,
  IconButton,
  Snackbar,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

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
    color?: "inherit" | "primary" | "secondary";
    variant?: "text" | "outlined" | "contained";
  };

  /**
   * Custom close button configuration
   */
  closable?: {
    enabled: boolean;
    label?: string; // For accessibility
  };

  /**
   * Position on screen
   * @default { vertical: 'bottom', horizontal: 'left' }
   */
  position?: {
    vertical: "top" | "bottom";
    horizontal: "left" | "center" | "right";
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

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Active toast state
 */
interface ActiveToast extends ToastConfig {
  id: string;
  open: boolean;
}

/**
 * Default toast configuration
 */
const DEFAULT_TOAST_CONFIG: Partial<ToastConfig> = {
  enabled: true,
  severity: "info",
  duration: 4000,
  position: {
    vertical: "bottom",
    horizontal: "left",
  },
  closable: {
    enabled: true,
    label: "Close notification",
  },
};

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
export function ToastProvider({
  children,
  maxToasts = 3,
  defaultConfig = {},
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const mergedDefaultConfig = useMemo(
    () => ({ ...DEFAULT_TOAST_CONFIG, ...defaultConfig }),
    [defaultConfig],
  );

  const generateId = () =>
    `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const showToast = useCallback(
    (config: ToastConfig): string => {
      // If toast is disabled, return empty ID and don't show
      if (config.enabled === false) {
        return "";
      }

      const id = config.id || generateId();
      const mergedConfig = {
        ...mergedDefaultConfig,
        ...config,
        id,
        open: true,
      };

      setToasts((prev) => {
        const newToasts = [mergedConfig, ...prev];

        // Limit the number of toasts
        if (newToasts.length > maxToasts) {
          return newToasts.slice(0, maxToasts);
        }

        return newToasts;
      });

      // Call onOpen callback if provided
      config.onOpen?.();

      return id;
    },
    [mergedDefaultConfig, maxToasts],
  );

  const hideToast = useCallback((id?: string) => {
    setToasts((prev) => {
      if (!id) {
        // Hide the most recent toast if no ID provided
        if (prev.length > 0) {
          const toastToClose = prev[0];
          if (toastToClose) {
            toastToClose.onClose?.();
          }
          return prev.slice(1);
        }
        return prev;
      }

      const toastToClose = prev.find((t) => t.id === id);
      if (toastToClose) {
        toastToClose.onClose?.();
      }

      return prev.filter((toast) => toast.id !== id);
    });
  }, []);

  const hideAllToasts = useCallback(() => {
    setToasts((prev) => {
      prev.forEach((toast) => toast.onClose?.());
      return [];
    });
  }, []);

  const isVisible = useCallback(
    (id: string): boolean => {
      return toasts.some((toast) => toast.id === id && toast.open);
    },
    [toasts],
  );

  const updateToast = useCallback(
    (id: string, updates: Partial<ToastConfig>) => {
      setToasts((prev) =>
        prev.map((toast) =>
          toast.id === id ? { ...toast, ...updates } : toast,
        ),
      );
    },
    [],
  );

  const handleClose = useCallback(
    (id: string) => {
      hideToast(id);
    },
    [hideToast],
  );

  return (
    <ToastContext.Provider
      value={{
        showToast,
        hideToast,
        hideAllToasts,
        isVisible,
        updateToast,
      }}
    >
      {children}

      {/* Render active toasts */}
      {toasts.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open={toast.open}
          autoHideDuration={toast.duration}
          onClose={() => handleClose(toast.id)}
          anchorOrigin={toast.position}
          sx={{
            // Stack toasts vertically
            "& .MuiSnackbar-root": {
              position: "static",
              transform: "none",
            },
            // Adjust position based on stack index
            bottom:
              toast.position?.vertical === "bottom"
                ? `${80 + index * 70}px`
                : undefined,
            top:
              toast.position?.vertical === "top"
                ? `${80 + index * 70}px`
                : undefined,
          }}
          {...toast.snackbarProps}
        >
          <Alert
            severity={toast.severity}
            onClose={
              toast.closable?.enabled ? () => handleClose(toast.id) : undefined
            }
            sx={{
              ...toast.style,
              "& .MuiAlert-message": {
                display: "flex",
                alignItems: "center",
                gap: 1,
              },
            }}
            action={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {toast.action && (
                  <Button
                    color={toast.action.color || "inherit"}
                    variant={toast.action.variant || "text"}
                    size="small"
                    onClick={toast.action.onClick}
                  >
                    {toast.action.label}
                  </Button>
                )}
                {toast.closable?.enabled && (
                  <IconButton
                    aria-label={toast.closable.label || "Close notification"}
                    color="inherit"
                    size="small"
                    onClick={() => handleClose(toast.id)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            }
            {...toast.alertProps}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast functionality
 */
export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
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
      showToast({ ...options, message, severity: "success" }),

    error: (message: ReactNode, options?: Partial<ToastConfig>) =>
      showToast({ ...options, message, severity: "error" }),

    warning: (message: ReactNode, options?: Partial<ToastConfig>) =>
      showToast({ ...options, message, severity: "warning" }),

    info: (message: ReactNode, options?: Partial<ToastConfig>) =>
      showToast({ ...options, message, severity: "info" }),

    custom: (config: ToastConfig) => showToast(config),
  };
}
