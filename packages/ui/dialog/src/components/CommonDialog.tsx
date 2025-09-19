/**
 * @fileoverview CommonDialog - Base base-dialog component for plugins
 */

import React, { useCallback, useState } from 'react';
import { Dialog, DialogContent } from '@mui/material';
import { UnsavedChangesDialog } from './UnsavedChangesDialog.js';
import { CommonDialogActions } from './CommonDialogActions.js';
import { CommonDialogTitle } from './CommonDialogTitle.js';

export interface CommonPluginDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  nodeId?: string;
  parentId?: string;
  title: string;
  subtitle?: string;
  isDraft?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;

  // Dialog size
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  initialDisplayMode?: 'standard' | 'maximized' | 'fullscreen';
  onDisplayModeChange?: (mode: 'standard' | 'maximized' | 'fullscreen') => void;

  // State management
  hasUnsavedChanges?: boolean;
  supportsDraft?: boolean;
  isValid?: boolean;

  // Actions
  onSubmit: () => Promise<void> | void;
  onSaveDraft?: () => Promise<void> | void;
  onCancel: () => void;

  // Additional actions
  additionalActions?: React.ReactNode;
  headerActions?: React.ReactNode;
}

export const CommonDialog: React.FC<CommonPluginDialogProps> = ({
                                                                  mode,
                                                                  open,
                                                                  nodeId,
                                                                  parentId: _parentId, // TODO: Use for create mode
                                                                  title,
                                                                  subtitle,
                                                                  isDraft = false,
                                                                  icon,
                                                                  children,
                                                                  maxWidth = 'md',
                                                                  initialDisplayMode = 'standard',
                                                                  onDisplayModeChange,
                                                                  hasUnsavedChanges = false,
                                                                  supportsDraft = false,
                                                                  isValid = true,
                                                                  onSubmit,
                                                                  onSaveDraft,
                                                                  onCancel,
                                                                  additionalActions,
                                                                }) => {
  const [displayMode, setDisplayMode] = useState<'standard' | 'maximized' | 'fullscreen'>(initialDisplayMode);
  const isFullscreen = displayMode === 'fullscreen';
  const isMaximized = displayMode === 'maximized';
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle base-dialog close
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true);
    } else {
      onCancel();
    }
  }, [hasUnsavedChanges, onCancel]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!isValid || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSubmit();
    } catch (error) {
      console.error('Dialog submission failed:', error);
      // Error handling should be done by parent component
    } finally {
      setIsSubmitting(false);
    }
  }, [isValid, isSubmitting, onSubmit]);

  // Handle save draft
  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft) return;

    try {
      await onSaveDraft();
      setShowUnsavedChangesDialog(false);
      onCancel();
    } catch (error) {
      console.error('Save draft failed:', error);
    }
  }, [onSaveDraft, onCancel]);

  // Handle discard changes
  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedChangesDialog(false);
    onCancel();
  }, [onCancel]);

  const handleDisplayModeChange = useCallback((mode: 'standard' | 'maximized' | 'fullscreen') => {
    setDisplayMode(mode);
    onDisplayModeChange?.(mode);
  }, [onDisplayModeChange]);

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth={isFullscreen ? false : maxWidth}
        fullWidth={!isFullscreen && !isMaximized}
        fullScreen={isFullscreen}
        disableEscapeKeyDown={hasUnsavedChanges}
        PaperProps={
          isFullscreen
            ? {
              sx: {
                borderRadius: 2,
                m: 2,
                height: 'calc(100% - 32px)',
                width: 'calc(100% - 32px)',
                maxHeight: 'calc(100% - 32px)',
                maxWidth: 'calc(100% - 32px)',
              },
            }
            : {}
        }
      >
        <CommonDialogTitle
          title={title}
          subtitle={subtitle}
          onClose={handleClose}
          icon={icon}
          mode={mode}
          nodeId={nodeId}
          isDraft={isDraft}
          displayMode={displayMode}
          onChangeDisplayMode={handleDisplayModeChange}
        />

        <DialogContent sx={{ flex: 1, minHeight: 0 }}>{children}</DialogContent>

        <CommonDialogActions
          mode={mode}
          isValid={isValid}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onCancel={handleClose}
          displayMode={displayMode}
          additionalActions={additionalActions}
        />
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedChangesDialog}
        title={`Discard ${title}?`}
        message="You have unsaved changes. Are you sure you want to discard your changes?"
        showSaveDraft={supportsDraft && !!onSaveDraft}
        onDiscard={handleDiscardChanges}
        onSaveDraft={handleSaveDraft}
        onCancel={() => setShowUnsavedChangesDialog(false)}
      />
    </>
  );
};
