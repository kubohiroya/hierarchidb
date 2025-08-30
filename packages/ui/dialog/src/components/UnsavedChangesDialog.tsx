/**
 * @fileoverview UnsavedChangesDialog - Confirmation dialog for discarding unsaved changes
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Stack,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

export interface UnsavedChangesDialogProps {
  open: boolean;
  title: string;
  message: string;
  /**
   * Optional children to display specific unsaved changes details
   * e.g., diff view, list of modified fields, etc.
   */
  children?: React.ReactNode;
  showSaveDraft?: boolean;
  onDiscard: () => void;
  onSaveDraft?: () => void;
  onCancel: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  open,
  title,
  message,
  children,
  showSaveDraft = false,
  onDiscard,
  onSaveDraft,
  onCancel,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <WarningIcon color="warning" />
          <Typography variant="h6">{title}</Typography>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Unsaved Changes</AlertTitle>
          <Typography variant="body2">{message}</Typography>
        </Alert>
        
        {/* Display specific unsaved changes if provided */}
        {children && (
          <Stack sx={{ mb: 2, mt: 2 }}>
            {children}
          </Stack>
        )}
        
        <Typography variant="body2" color="text.secondary">
          Choose one of the following options:
        </Typography>
        
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Typography variant="body2">
            • <strong>Cancel</strong>: Continue editing and keep your changes
          </Typography>
          {showSaveDraft && onSaveDraft && (
            <Typography variant="body2">
              • <strong>Save as Draft</strong>: Save your progress and close
            </Typography>
          )}
          <Typography variant="body2">
            • <strong>Discard</strong>: Close without saving (changes will be lost)
          </Typography>
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={onCancel}
          variant="outlined"
          size="large"
        >
          Cancel
        </Button>
        
        {showSaveDraft && onSaveDraft && (
          <Button
            onClick={onSaveDraft}
            variant="contained"
            size="large"
            startIcon={<SaveIcon />}
            color="primary"
          >
            Save as Draft
          </Button>
        )}
        
        <Button
          onClick={onDiscard}
          variant="contained"
          size="large"
          startIcon={<DeleteIcon />}
          color="error"
        >
          Discard
        </Button>
      </DialogActions>
    </Dialog>
  );
};