import type { ReactElement } from 'react';
import { Button } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface CloseActionButtonProps {
  to: string;
}

export function CloseActionButton({ to }: CloseActionButtonProps): ReactElement {
  const { t } = useTranslation('common');
  const closeLabel = t('dialogs.common.actions.close', 'Close dialog');
  return (
    <Button
      onClick={() => (window.location.href = to)}
      variant="text"
      size="small"
      sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        minWidth: 'auto',
        borderRadius: '50%',
        p: 1,
      }}
      aria-label={closeLabel}
      title={closeLabel}
    >
      <CloseIcon />
    </Button>
  );
}
