// components/LinkButton.tsx

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  ButtonProps,
  CircularProgress,
} from '@mui/material';
import { useLinkButton } from './useLinkButton';
import type { ToastConfig } from '@/shared/components/toast/ToastProvider';

/**
 * Toast notification configuration
 * Re-export from shared components for convenience
 */
export type { ToastConfig };

/**
 * Confirmation dialog configuration
 */
export interface ConfirmDialogConfig {
  enabled: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonProps?: Partial<ButtonProps>;
}

/**
 * Multi-step workflow configuration
 */
export interface WorkflowStep {
  validate?: () => Promise<boolean> | boolean;
  execute: () => Promise<void>;
  onError?: (error: Error) => void;
  successMessage?: string;
  successToast?: ToastConfig;
  errorToast?: ToastConfig;
}

/**
 * Props for the {@link LinkButton} component.
 */
export interface LinkButtonProps extends Omit<ButtonProps, 'onClick'> {
  /**
   * Path to navigate to after the action.
   * If not provided, no navigation occurs.
   */
  to?: string;

  /**
   * If true, replaces the current history entry.
   */
  replace?: boolean;

  /**
   * Optional state to pass with navigation.
   */
  state?: unknown;

  /**
   * Validation function to run before action.
   * Return false to cancel the action.
   */
  validate?: () => Promise<boolean> | boolean;

  /**
   * Validation error messages to display
   */
  validationErrors?: string[];

  /**
   * Confirmation dialog configuration
   */
  confirmDialog?: ConfirmDialogConfig;

  /**
   * Database save operation
   */
  onSave?: () => Promise<void>;

  /**
   * Cleanup operation before navigation
   */
  onCleanup?: () => Promise<void>;

  /**
   * Multi-step workflow steps
   */
  steps?: WorkflowStep[];

  /**
   * Async function to run before navigation.
   * Return `false` to cancel navigation.
   * @deprecated Use `validate` or `steps` instead
   */
  onBeforeNavigate?: () => Promise<boolean | void>;

  /**
   * Callback before any action starts
   */
  onBeforeAction?: () => Promise<boolean> | boolean;

  /**
   * Optional callback when navigation succeeds.
   * @deprecated Use `onSuccess` instead
   */
  onSuccessNavigate?: () => void;

  /**
   * Callback when all operations complete successfully
   */
  onSuccess?: () => void;

  /**
   * Optional callback when an error occurs.
   */
  onError?: (error: unknown) => void;

  /**
   * Text to display while loading
   */
  loadingText?: string;

  /**
   * Prevents double-click during async operation.
   * @default true
   */
  preventDoubleClick?: boolean;

  /**
   * Show success message after completion
   * @deprecated Use successToast instead
   */
  showSuccessMessage?: boolean;

  /**
   * Success message to display
   * @deprecated Use successToast instead
   */
  successMessage?: string;

  /**
   * Success toast configuration
   */
  successToast?: ToastConfig;

  /**
   * Error toast configuration
   */
  errorToast?: ToastConfig;

  /**
   * Global toast notification handler
   */
  onToast?: (config: ToastConfig) => void;

  /**
   * Accessible label for screen readers (overrides children if provided).
   */
  ariaLabel?: string;
}

/**
 * A versatile navigation button with async pre-processing,
 * built-in loading state, double-click prevention, and accessibility support.
 *
 * @example
 * ```tsx
 * // Simple navigation
 * <LinkButton to="/next" variant="contained">
 *   Next
 * </LinkButton>
 *
 * // With validation
 * <LinkButton
 *   to="/next"
 *   validate={() => form.isValid()}
 *   onError={(err) => showError(err)}
 * >
 *   Submit
 * </LinkButton>
 *
 * // With confirmation dialog
 * <LinkButton
 *   confirmDialog={{
 *     enabled: true,
 *     title: "Delete Item",
 *     message: "Are you sure you want to delete this item?"
 *   }}
 *   onSave={async () => await deleteItem()}
 *   onSuccess={() => showToast("Deleted")}
 *   color="error"
 * >
 *   Delete
 * </LinkButton>
 *
 * // Multi-step workflow
 * <LinkButton
 *   to="../.."
 *   replace
 *   steps={[
 *     {
 *       validate: () => form.isValid(),
 *       execute: async () => await saveData(),
 *     },
 *     {
 *       execute: async () => await cleanup(),
 *     }
 *   ]}
 *   loadingText="Saving..."
 * >
 *   Save and Close
 * </LinkButton>
 * ```
 */
export const LinkButton: React.FC<LinkButtonProps> = (props) => {
  const {
    // Extract all LinkButton-specific props that shouldn't go to Button
    to: _to,
    replace: _replace,
    state: _state,
    validate: _validate,
    confirmDialog,
    onSave: _onSave,
    onCleanup: _onCleanup,
    steps: _steps,
    onBeforeNavigate: _onBeforeNavigate,
    onBeforeAction: _onBeforeAction,
    onSuccessNavigate: _onSuccessNavigate,
    onSuccess: _onSuccess,
    onError: _onError,
    loadingText,
    preventDoubleClick: _preventDoubleClick,
    showSuccessMessage: _showSuccessMessage,
    successMessage: _successMessage,
    successToast: _successToast,
    errorToast: _errorToast,
    onToast: _onToast,
    ariaLabel,
    children,
    validationErrors: _validationErrors,
    ...buttonProps
  } = props;

  const { loading, confirmOpen, handleClick, handleConfirm, handleCancel } = useLinkButton(props);

  return (
    <>
      <Button
        {...buttonProps}
        onClick={handleClick}
        disabled={loading || buttonProps.disabled}
        aria-busy={loading || undefined}
        aria-label={ariaLabel}
        startIcon={loading ? <CircularProgress size={16} /> : buttonProps.startIcon}
      >
        {loading && loadingText ? loadingText : children}
      </Button>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <Dialog
          open={confirmOpen}
          onClose={handleCancel}
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
        >
          {confirmDialog.title && (
            <DialogTitle id="confirm-dialog-title">{confirmDialog.title}</DialogTitle>
          )}
          <DialogContent>
            <DialogContentText id="confirm-dialog-description">
              {confirmDialog.message}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleCancel}
              color="primary"
              aria-label="cancel-confirmation-dialog"
              role="button"
            >
              {confirmDialog.cancelText || 'Cancel'}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading}
              color="primary"
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} /> : undefined}
              aria-label="confirm-action"
              role="button"
              {...confirmDialog.confirmButtonProps}
            >
              {confirmDialog.confirmText || 'Confirm'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};
