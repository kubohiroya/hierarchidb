import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

interface ShapeDialogProps {
  mode: 'create' | 'edit';
  parentId?: string;
  nodeId?: string;
  onClose: () => void;
  open: boolean;
}

export const ShapeDialog: React.FC<ShapeDialogProps> = ({
  mode,
  parentId,
  nodeId,
  onClose,
  open,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Create Shape Layer' : 'Edit Shape Layer'}</DialogTitle>
      <DialogContent>
        {/* Shape configuration form will go here */}
        <div>
          {mode === 'create'
            ? `Creating shape layer in parent: ${parentId}`
            : `Editing shape layer: ${nodeId}`}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onClose}>
          {mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
