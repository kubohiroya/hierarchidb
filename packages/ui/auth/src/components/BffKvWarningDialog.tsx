import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useBffKvWarningDialogView } from './useBffKvWarningDialogView.js';

export const BffKvWarningDialog: React.FC = () => {
  const { t } = useTranslation('common');
  const { warning, detailText, handleClose } = useBffKvWarningDialogView();

  return (
    <Dialog open={Boolean(warning)} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('auth.kvFallback.title', 'Authentication warning')}</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {t(
              'auth.kvFallback.summary',
              'Server-side session storage is unavailable. Some authentication operations are limited.'
            )}
          </Typography>
        </Alert>
        {detailText ? (
          <Typography variant="body2" sx={{ mb: 2 }}>
            {detailText}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {t(
            'auth.kvFallback.recoveryNotice',
            'Recovery depends on server configuration and Cloudflare service status. If refresh is unavailable, sign in again when prompted.'
          )}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('auth.kvFallback.action', 'Close')}</Button>
      </DialogActions>
    </Dialog>
  );
};
