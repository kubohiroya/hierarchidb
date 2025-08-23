/**
 * @file useLinkButton.ts
 * @description Custom hook for LinkButton functionality
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LinkButtonProps, ToastConfig } from './LinkButton';
// Mock toast hook
const useToast = () => ({
  showToast: (config: any) => console.log('Toast:', config),
});

/**
 * Return type for useLinkButton hook
 */
export interface UseLinkButtonReturn {
  loading: boolean;
  confirmOpen: boolean;
  handleClick: () => Promise<void>;
  handleConfirm: () => void;
  handleCancel: () => void;
  executeAction: () => Promise<void>;
  setConfirmOpen: (open: boolean) => void;
}

/**
 * Custom hook for LinkButton logic
 * Extracted for reusability and testing
 */
export function useLinkButton(props: LinkButtonProps): UseLinkButtonReturn {
  const {
    to,
    replace = false,
    state,
    validate,
    confirmDialog,
    onSave,
    onCleanup,
    steps,
    onBeforeNavigate,
    onBeforeAction,
    onSuccessNavigate,
    onSuccess,
    onError,
    showSuccessMessage,
    successMessage,
    successToast,
    errorToast,
    onToast,
    preventDoubleClick = true,
  } = props;

  const navigate = useNavigate();
  const { showToast: systemShowToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasClicked = useRef(false);

  /**
   * Show toast notification using either the provided onToast callback or the system toast
   */
  const showToast = useCallback(
    (config: ToastConfig) => {
      // Skip if explicitly disabled
      if (config.enabled === false) {
        return;
      }

      // Use external handler if provided
      if (onToast) {
        onToast(config);
        return;
      }

      // Otherwise use the system toast
      systemShowToast(config);
    },
    [onToast, systemShowToast]
  );

  const executeAction = useCallback(async () => {
    setLoading(true);
    try {
      // Execute multi-step workflow if provided
      if (steps && steps.length > 0) {
        for (const step of steps) {
          // Validate step if validator provided
          if (step.validate) {
            const isValid = await step.validate();
            if (!isValid) {
              throw new Error('Validation failed');
            }
          }

          // Execute step
          try {
            await step.execute();

            // Show success toast for step if provided
            if (step.successToast) {
              showToast(step.successToast);
            } else if (step.successMessage && showSuccessMessage) {
              // Fallback to legacy success message
              showToast({
                message: step.successMessage,
                severity: 'success',
                enabled: true,
              });
            }
          } catch (error) {
            const err = error as Error;

            // Show error toast for step
            if (step.errorToast) {
              showToast({
                ...step.errorToast,
                // Allow custom message to include error details
                message:
                  typeof step.errorToast.message === 'string'
                    ? step.errorToast.message.replace('{error}', err.message)
                    : step.errorToast.message,
              });
            } else {
              // Default error toast for failed step
              showToast({
                message: `Step failed: ${err.message}`,
                severity: 'error',
                enabled: true,
                duration: 5000,
              });
            }

            if (step.onError) {
              step.onError(err);
            }
            throw error;
          }
        }
      }

      // Execute single save operation if provided
      if (onSave) {
        await onSave();
      }

      // Legacy support for onBeforeNavigate
      if (onBeforeNavigate) {
        const shouldProceed = await onBeforeNavigate();
        if (shouldProceed === false) {
          return;
        }
      }

      // Execute cleanup if provided
      if (onCleanup) {
        await onCleanup();
      }

      // Navigate if destination provided
      if (to) {
        navigate(to, { replace, state });
      }

      // Call success callbacks
      onSuccess?.();
      onSuccessNavigate?.(); // Legacy support

      // Show final success toast
      if (successToast) {
        showToast(successToast);
      } else if (successMessage && showSuccessMessage) {
        // Fallback to legacy success message
        showToast({
          message: successMessage,
          severity: 'success',
          enabled: true,
        });
      }
    } catch (err) {
      const error = err as Error;

      // Show error toast
      if (errorToast) {
        // Use custom error toast config if provided
        showToast({
          ...errorToast,
          // Allow custom message to include error details
          message:
            typeof errorToast.message === 'string'
              ? errorToast.message.replace('{error}', error.message)
              : errorToast.message,
        });
      } else {
        // Default error toast if no custom config
        showToast({
          message: error.message || 'An error occurred',
          severity: 'error',
          enabled: true,
          duration: 5000, // Errors stay longer
        });
      }

      onError?.(error);
      throw error; // Re-throw to handle in calling function
    } finally {
      setLoading(false);
      hasClicked.current = false;
      setConfirmOpen(false);
    }
  }, [
    steps,
    onSave,
    onBeforeNavigate,
    onCleanup,
    to,
    navigate,
    replace,
    state,
    onSuccess,
    onSuccessNavigate,
    successMessage,
    showSuccessMessage,
    successToast,
    errorToast,
    showToast,
    onError,
  ]);

  const handleClick = useCallback(async () => {
    if (preventDoubleClick && hasClicked.current) return;
    hasClicked.current = true;

    try {
      // Call onBeforeAction if provided
      if (onBeforeAction) {
        const shouldProceed = await onBeforeAction();
        if (!shouldProceed) {
          hasClicked.current = false;
          return;
        }
      }

      // Run validation if provided
      if (validate) {
        const isValid = await validate();
        if (!isValid) {
          hasClicked.current = false;
          // Show validation error toast
          showToast({
            message: 'Please fix the validation errors before proceeding',
            severity: 'error',
            enabled: true,
            duration: 4000,
          });
          return;
        }
      }

      // Show confirmation dialog if configured
      if (confirmDialog?.enabled) {
        setConfirmOpen(true);
        return;
      }

      // Execute action immediately if no confirmation needed
      await executeAction();
    } catch (err) {
      const error = err as Error;

      // Show error toast for unexpected errors during click handling
      showToast({
        message: error.message || 'An unexpected error occurred',
        severity: 'error',
        enabled: true,
        duration: 5000,
      });

      onError?.(error);
      hasClicked.current = false;
    }
  }, [
    preventDoubleClick,
    onBeforeAction,
    validate,
    confirmDialog,
    executeAction,
    showToast,
    onError,
  ]);

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    executeAction();
  }, [executeAction]);

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
    hasClicked.current = false;
  }, []);

  return {
    loading,
    confirmOpen,
    handleClick,
    handleConfirm,
    handleCancel,
    executeAction,
    setConfirmOpen,
  };
}
