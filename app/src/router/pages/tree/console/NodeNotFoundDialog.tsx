import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

type NodeNotFoundDialogProps = {
  open: boolean;
  pageNodeId: string | undefined;
  onClose: () => void;
  onGoToTreeRoot: () => void;
};

export function NodeNotFoundDialog({
  open,
  pageNodeId,
  onClose,
  onGoToTreeRoot,
}: NodeNotFoundDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Node Not Found</DialogTitle>
      <DialogContent>
        <Typography>Node Not Found: ({pageNodeId ?? 'Unknown'})</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onGoToTreeRoot} variant="contained" autoFocus>
          Go to Tree Root
        </Button>
      </DialogActions>
    </Dialog>
  );
}
