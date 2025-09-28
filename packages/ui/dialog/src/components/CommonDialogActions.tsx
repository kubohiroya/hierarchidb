/**
 * @fileoverview CommonDialogActions - Standardized base-dialog action buttons
 */

import type React from 'react';
import { Button, DialogActions, Stack } from '@mui/material';

export interface CommonDialogActionsProps {
  mode: 'create' | 'edit';
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
  if (displayMode !== 'full-screen') {
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
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </Stack>
      </Stack>
    </DialogActions>
  );
};
