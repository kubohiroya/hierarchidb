import type { HeapPressureEvent } from '@hierarchidb/memory';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

type Props = {
  open: boolean;
  event: HeapPressureEvent | null;
  onClose: () => void;
  title?: string;
  confirmLabel?: string;
  description?: string;
};

const formatMegabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

export const HeapPressureDialog = ({
  open,
  event,
  onClose,
  title = 'Build paused due to memory pressure',
  confirmLabel = 'OK',
  description = 'Reduce concurrency and resume when ready.',
}: Props) => {
  if (!event) return null;
  const ratioPercent = Math.round(event.ratio * 100);
  const usedMb = formatMegabytes(event.usedBytes);
  const limitMb = formatMegabytes(event.limitBytes);
  const severity = event.level === 'critical' ? 'error' : 'warning';

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Alert severity={severity} sx={{ mb: 2 }}>
          High JS heap usage detected ({ratioPercent}% / {usedMb}MB of {limitMb}MB).
        </Alert>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
};
