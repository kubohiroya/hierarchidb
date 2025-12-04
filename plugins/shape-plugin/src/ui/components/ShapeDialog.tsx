import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import type { NodeId } from '../../common/shared/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig, type ShapeEntity } from '../../common/shared/index.js';

export interface ShapeDialogProps {
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  open: boolean;
  onClose: () => void;
  onSuccess?: (entity: ShapeEntity) => void;
  onError?: (error: Error) => void;
}

export function ShapeDialog({
  mode,
  nodeId,
  parentId,
  open,
  onClose,
  onSuccess,
  onError,
}: ShapeDialogProps): JSX.Element {
  const [name, setName] = useState('');
  void parentId;

  const handleSubmit = () => {
    try {
      const now = Date.now();
      const id = nodeId ?? (`shape-${now}` as NodeId);
      const entity: ShapeEntity = {
        id,
        nodeId: id,
        metadata: {
          name: name.trim() || (mode === 'create' ? 'New shape' : 'Shape'),
          description: '',
          tags: [],
        },
        dataSourceName: 'naturalearth',
        licenseAgreement: true,
        processingConfig: mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG),
        checkboxState: [],
        selectedCountries: [],
        adminLevels: [],
        urlMetadata: [],
      };
      onSuccess?.(entity);
      onClose();
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('failed to submit shape'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Create Shape' : 'Edit Shape'}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          margin="dense"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
