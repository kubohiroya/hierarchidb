import { useCallback, useState } from 'react';
import type { DialogDisplayMode } from '@hierarchidb/tree-api';

export interface UseCommonDialogViewParams {
  initialDisplayMode: DialogDisplayMode;
  hasUnsavedChanges: boolean;
  isValid: boolean;
  onSubmit: () => Promise<void> | void;
  onSaveDraft?: () => Promise<void> | void;
  onCancel: () => void;
  onDisplayModeChange?: (mode: DialogDisplayMode) => void;
}

export interface UseCommonDialogViewResult {
  displayMode: DialogDisplayMode;
  isFullscreen: boolean;
  isMaximized: boolean;
  showUnsavedChangesDialog: boolean;
  isSubmitting: boolean;
  setShowUnsavedChangesDialog: (open: boolean) => void;
  handleClose: () => void;
  handleSubmit: () => Promise<void>;
  handleSaveDraft: () => Promise<void>;
  handleDiscardChanges: () => void;
  handleDisplayModeChange: (mode: DialogDisplayMode) => void;
}

export function useCommonDialogView({
  initialDisplayMode,
  hasUnsavedChanges,
  isValid,
  onSubmit,
  onSaveDraft,
  onCancel,
  onDisplayModeChange,
}: UseCommonDialogViewParams): UseCommonDialogViewResult {
  const [displayMode, setDisplayMode] = useState<DialogDisplayMode>(initialDisplayMode);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true);
      return;
    }
    onCancel();
  }, [hasUnsavedChanges, onCancel]);

  const handleSubmit = useCallback(async () => {
    if (!isValid || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onSubmit();
    } catch (error) {
      console.error('Dialog submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isValid, onSubmit]);

  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft) return;
    try {
      await onSaveDraft();
      setShowUnsavedChangesDialog(false);
      onCancel();
    } catch (error) {
      console.error('Save draft failed:', error);
    }
  }, [onCancel, onSaveDraft]);

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedChangesDialog(false);
    onCancel();
  }, [onCancel]);

  const handleDisplayModeChange = useCallback(
    (mode: DialogDisplayMode) => {
      setDisplayMode(mode);
      onDisplayModeChange?.(mode);
    },
    [onDisplayModeChange],
  );

  const isFullscreen = displayMode === 'full-screen';
  const isMaximized = displayMode === 'maximize';

  return {
    displayMode,
    isFullscreen,
    isMaximized,
    showUnsavedChangesDialog,
    isSubmitting,
    setShowUnsavedChangesDialog,
    handleClose,
    handleSubmit,
    handleSaveDraft,
    handleDiscardChanges,
    handleDisplayModeChange,
  };
}
