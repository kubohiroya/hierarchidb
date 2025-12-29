import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { BatchSession } from '../../common/types/index.js';
import { useBatchRecoveryDialog } from '../hooks/useBatchRecoveryDialog.js';

export interface BatchRecoveryDialogProps {
  open: boolean;
  sessions: BatchSession[];
  onResume: (session: BatchSession) => void;
  onDiscard: (nodeId: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export function BatchRecoveryDialog({
  open,
  sessions,
  onResume,
  onDiscard,
  onClose,
  loading = false,
}: BatchRecoveryDialogProps): JSX.Element | null {
  const { shouldRender } = useBatchRecoveryDialog({ open, sessions, loading });
  void sessions;
  void onResume;
  void onDiscard;
  void loading;

  if (!shouldRender) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Resume Batch Session</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Batch session recovery UI is under reconstruction. Please resume or discard sessions
          via the worker tools until the refactor is complete.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
