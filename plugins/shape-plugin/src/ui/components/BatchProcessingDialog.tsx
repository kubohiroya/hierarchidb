import { useEffect } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { NodeId } from '../../common/types/index.js';
import { ShapeBatchProgressDisplay } from './ShapeBatchProgressDisplay.js';
import { useShapeProgress } from '../hooks/useShapeProgress.js';

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
 * heavy runtime-worker dependencies that the legacy implementation relied on.
 */
export function BatchProcessingDialog({
  open,
  onClose,
  sessionId,
  draftId,
  onComplete,
  onError,
}: BatchProcessingDialogProps): JSX.Element {
  const { status, error } = useShapeProgress(sessionId, { autoSubscribe: open });

  useEffect(() => {
    if (!onComplete || !status) return;
    if (status.status === 'completed') onComplete('success');
    else if (status.status === 'cancelled') onComplete('cancelled');
    else if (status.status === 'failed') onComplete('error');
  }, [onComplete, status]);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Batch Processing</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Session <strong>{sessionId}</strong> (draft <strong>{draftId}</strong>) progress
          </Typography>
          <ShapeBatchProgressDisplay sessionId={sessionId} draftId={draftId} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
