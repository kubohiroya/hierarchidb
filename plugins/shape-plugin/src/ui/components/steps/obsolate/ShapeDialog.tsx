import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import type { NodeId } from '../../../../common/shared/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig, type ShapeEntity } from '../../../../common/shared/index.js';
import { useTranslation } from '../../../../common/i18n/index.js';

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
  const { t } = useTranslation();
  const [name, setName] = useState('');
  void parentId;

  const handleSubmit = () => {
    try {
      const now = Date.now();
      const id = nodeId ?? (`shape-${now}` as NodeId);
      const entity: ShapeEntity = {
        id,
        metadata: {
          name: name.trim() || (mode === 'create' ? t('dialog.defaultName', 'New shape') : 'Shape'),
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
      <DialogTitle>{mode === 'create' ? t('dialog.createTitle', 'Create Shape') : t('dialog.editTitle', 'Edit Shape')}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label={t('dialog.name', 'Name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          margin="dense"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('dialog.cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit}>
          {t('dialog.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
