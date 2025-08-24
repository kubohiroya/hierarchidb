/**
 * @fileoverview CommonPluginDialog - Base dialog component for plugins
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Stack,
  Box,
} from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { CommonDialogActions } from './CommonDialogActions';

export interface CommonPluginDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  nodeId?: string;
  parentNodeId?: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  
  // Dialog size
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullScreen?: boolean;
  
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

export const CommonPluginDialog: React.FC<CommonPluginDialogProps> = ({
  mode,
  open,
  nodeId,
  parentNodeId: _parentNodeId, // TODO: Use for create mode
  title,
  icon,
  children,
  maxWidth = 'md',
  fullScreen: initialFullScreen = false,
  hasUnsavedChanges = false,
  supportsDraft = false,
  isValid = true,
  onSubmit,
  onSaveDraft,
  onCancel,
  additionalActions,
  headerActions,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(initialFullScreen);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Handle dialog close
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
  
  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);
  
  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth={isFullscreen ? false : maxWidth}
        fullWidth={!isFullscreen}
        fullScreen={isFullscreen}
        disableEscapeKeyDown={hasUnsavedChanges}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              {icon}
              <Typography variant="h6">{title}</Typography>
              {mode === 'edit' && nodeId && (
                <Typography variant="caption" color="text.secondary">
                  ({nodeId})
                </Typography>
              )}
            </Stack>
            
            <Stack direction="row" spacing={1}>
              {/* Fullscreen toggle */}
              <IconButton
                onClick={toggleFullscreen}
                color="inherit"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
              
              {headerActions}
              
              <IconButton
                onClick={handleClose}
                color="inherit"
                aria-label="Close dialog"
              >
                <CloseIcon />
              </IconButton>
            </Stack>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ flex: 1, minHeight: 0 }}>
          {children}
        </DialogContent>
        
        <DialogActions>
          <CommonDialogActions
            mode={mode}
            isValid={isValid}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            additionalActions={additionalActions}
          />
        </DialogActions>
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