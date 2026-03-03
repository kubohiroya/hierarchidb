/**
 * @fileoverview CommonDialogActions - Standardized base-dialog action buttons
 */

import type React from 'react';
import { Button, DialogActions, Stack } from '@mui/material';
import { useCommonDialogActionsView } from './useCommonDialogActionsView.js';

export interface CommonDialogActionsProps {
  mode: 'create' | 'edit' | 'preview';
  isValid?: boolean;
  isSubmitting?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  additionalActions?: React.ReactNode;
  displayMode?: 'normal' | 'maximize' | 'full-screen';
}

export const CommonDialogActions: React.FC<CommonDialogActionsProps> = ({
                                                                          mode,
                                                                          isValid = true,
                                                                          isSubmitting = false,
                                                                          onSubmit,
                                                                          onCancel,
                                                                          additionalActions,
                                                                          displayMode = 'normal',
                                                                        }) => {
  const { shouldRender, submitLabel, submitDisabled } = useCommonDialogActionsView({
    displayMode,
    mode,
    isValid,
    isSubmitting,
  });

  if (!shouldRender) {
    return null;
  }
  return (
    <DialogActions>
      <Stack direction="row" spacing={2} sx={{ width: '100%', justifyContent: 'space-between' }}>
        <Button onClick={onCancel} variant="outlined" size="large" disabled={isSubmitting}>
          Cancel
        </Button>

        <Stack direction="row" spacing={2}>
          {additionalActions}

          <Button
            onClick={onSubmit}
            variant="contained"
            size="large"
            disabled={submitDisabled}
          >
            {submitLabel}
          </Button>
        </Stack>
      </Stack>
    </DialogActions>
  );
};
