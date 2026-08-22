/**
 * @fileoverview UnsavedChangesDialog - Confirmation base-dialog for discarding unsaved changes
 */

import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  Delete as DeleteIcon,
  Save as SaveIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { DialogProps } from '@mui/material';
import {
  Alert,
  AlertTitle,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useUnsavedChangesDialogView } from './useUnsavedChangesDialogView.js';

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
  /**
   * Optional slotProps forwarded to MUI Dialog for z-index/transition overrides.
   */
  slotProps?: DialogProps['slotProps'];
  /**
   * Override paper props (e.g., z-index). slotProps takes precedence if both set.
   */
  PaperProps?: DialogProps['PaperProps'];
  /**
   * Override backdrop props (e.g., z-index). slotProps takes precedence if both set.
   */
  BackdropProps?: DialogProps['BackdropProps'];
  /**
   * Optional portal container. Defaults to document.body for consistent stacking context.
   */
  container?: DialogProps['container'];
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
  slotProps,
  PaperProps,
  BackdropProps,
  container,
}) => {
  const { t } = useTranslation('common');
  const { resolvedContainer, resolvedSlotProps } = useUnsavedChangesDialogView({
    container,
    slotProps,
  });

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      slotProps={resolvedSlotProps}
      PaperProps={PaperProps}
      BackdropProps={BackdropProps}
      container={resolvedContainer}
      disablePortal={false}
    >
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <WarningIcon color="warning" />
          <Typography variant="h6">{title}</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>{title || t('dialogs.unsaved.heading', 'Unsaved Changes')}</AlertTitle>
          <Typography variant="body2">{message}</Typography>
        </Alert>

        {/* Display specific unsaved changes if provided */}
        {children && <Stack sx={{ mb: 2, mt: 2 }}>{children}</Stack>}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onCancel} variant="outlined" size="large">
          {t('dialogs.unsaved.buttons.cancel', 'Cancel')}
        </Button>

        {showSaveDraft && onSaveDraft && (
          <Button
            onClick={onSaveDraft}
            variant="contained"
            size="large"
            startIcon={<SaveIcon />}
            color="primary"
          >
            {t('dialogs.unsaved.buttons.saveDraft', 'Save as Draft')}
          </Button>
        )}

        <Button
          onClick={onDiscard}
          variant="contained"
          size="large"
          startIcon={<DeleteIcon />}
          color="error"
        >
          {t('dialogs.unsaved.buttons.discard', 'Discard')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
