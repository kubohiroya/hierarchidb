import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { NodeId } from '../../common/shared/index.js';

export interface BatchProcessingDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  draftId: NodeId;
  onComplete?: (result: 'success' | 'cancelled' | 'error') => void;
  onError?: (error: Error) => void;
}

/**
 * Minimal placeholder dialog shown while the batch processing UI is being redesigned.
 * It surfaces the identifiers so that debugging remains possible without pulling in
 * heavy runtime dependencies that the legacy implementation relied on.
 */
export function BatchProcessingDialog({
  open,
  onClose,
  sessionId,
  draftId,
  onComplete,
  onError,
}: BatchProcessingDialogProps): JSX.Element {
  void onComplete;
  void onError;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Batch Processing</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Session <strong>{sessionId}</strong> (working copy <strong>{draftId}</strong>)
          is managed by the runtime worker. Detailed progress monitoring UI is intentionally
          deferred while the plugin migration is in progress.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
