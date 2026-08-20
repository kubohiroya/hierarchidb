import type { ShapeBuildSessionRecoverableContractError } from '@hierarchidb/shape-api';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { TranslateFn } from '~/ui/components/build-progress/useBuildProgressPanelState/useBuildProgressPanelStateComputedHelpers';

type ShapeBuildProgressPanelLegacySessionRecoveryDialogViewProps = {
  open: boolean;
  pending: boolean;
  error: ShapeBuildSessionRecoverableContractError;
  failureMessage: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  t: TranslateFn;
};

export const ShapeBuildProgressPanelLegacySessionRecoveryDialogView = ({
  open,
  pending,
  error,
  failureMessage,
  onCancel,
  onConfirm,
  t,
}: ShapeBuildProgressPanelLegacySessionRecoveryDialogViewProps) => (
  <Dialog
    open={open}
    disableEscapeKeyDown={pending}
    onClose={() => {
      if (!pending) onCancel();
    }}
  >
    <DialogTitle>
      {t('stage.legacySessionRecovery.title', 'Legacy build session requires recovery')}
    </DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 0.5 }}>
        <Typography variant="body2">
          {t(
            'stage.legacySessionRecovery.message',
            'This saved build session is missing required timing data and cannot be resumed. Recover it by deleting only this node’s build-session records and queued build tasks.'
          )}
        </Typography>
        <Alert severity="info">
          {t(
            'stage.legacySessionRecovery.preserved',
            'Source, geometry, and tile caches, generated outputs, node data, and draft configuration will be preserved.'
          )}
        </Alert>
        <Typography variant="caption" color="text.secondary">
          {`${error.fieldPath} (${error.stage}): ${error.message}`}
        </Typography>
        {failureMessage ? <Alert severity="error">{failureMessage}</Alert> : null}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button disabled={pending} onClick={onCancel}>
        {t('stage.legacySessionRecovery.cancel', 'Cancel')}
      </Button>
      <Button
        variant="contained"
        color="warning"
        disabled={pending}
        onClick={() => {
          void onConfirm();
        }}
      >
        {pending
          ? t('stage.legacySessionRecovery.recovering', 'Recovering...')
          : t('stage.legacySessionRecovery.confirm', 'Recover session')}
      </Button>
    </DialogActions>
  </Dialog>
);
