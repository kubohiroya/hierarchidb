import { Alert, Dialog, DialogActions, DialogContent, DialogTitle, Button, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BFF_WARNING_EVENT,
  type BffWarning,
  isBffWarning,
} from '../services/BffWarning.js';

const buildDetailKey = (operation: BffWarning['operation']): string =>
  `auth.kvFallback.detail.${operation}`;

export const BffKvWarningDialog: React.FC = () => {
  const { t } = useTranslation('common');
  const [warning, setWarning] = useState<BffWarning | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!isBffWarning(detail)) return;
      setWarning(detail);
    };
    window.addEventListener(BFF_WARNING_EVENT, handler);
    return () => window.removeEventListener(BFF_WARNING_EVENT, handler);
  }, []);

  const detailText = useMemo(() => {
    if (!warning) return '';
    return t(buildDetailKey(warning.operation), '');
  }, [t, warning]);

  const handleClose = () => setWarning(null);

  return (
    <Dialog open={Boolean(warning)} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('auth.kvFallback.title', 'Authentication warning')}</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {t(
              'auth.kvFallback.summary',
              'Server-side session storage is temporarily unavailable. Some authentication operations are limited.'
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
            'auth.kvFallback.resetNotice',
            'This limitation resets daily (around 09:00 JST).'
          )}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {t('auth.kvFallback.action', 'Close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
