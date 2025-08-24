/**
 * @fileoverview NotificationProvider - Wrapper for notistack SnackbarProvider
 */

import { SnackbarProvider } from 'notistack';
import { ReactNode } from 'react';

// Type assertion to work around notistack React 18 compatibility issue
const TypedSnackbarProvider = SnackbarProvider as any;

export interface NotificationProviderProps {
  children: ReactNode;
  /** Maximum number of snackbars to show simultaneously */
  maxSnack?: number;
  /** Where to anchor the snackbars */
  anchorOrigin?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  /** Auto hide duration in milliseconds */
  autoHideDuration?: number;
}

/**
 * NotificationProvider - Provides snackbar notification context to child components
 * 
 * This component wraps the notistack SnackbarProvider with sensible defaults
 * for the HierarchiDB dialog system.
 */
export function NotificationProvider({ 
  children,
  maxSnack = 3,
  anchorOrigin = { vertical: 'bottom', horizontal: 'left' },
  autoHideDuration = 6000,
}: NotificationProviderProps) {
  return (
    <TypedSnackbarProvider 
      maxSnack={maxSnack}
      anchorOrigin={anchorOrigin}
      autoHideDuration={autoHideDuration}
      preventDuplicate
      dense
    >
      {children}
    </TypedSnackbarProvider>
  );
}