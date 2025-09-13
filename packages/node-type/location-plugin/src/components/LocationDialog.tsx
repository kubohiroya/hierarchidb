/**
  * Location Dialog Component
   */

import React, { useEffect } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import { notify } from '@hierarchidb/ui-core';
import type { LocationDialogProps, LocationWorkingCopy } from '../types';
import { useWorkingCopy } from '@hierarchidb/ui-core';

export const LocationDialog: React.FC<LocationDialogProps> = ({
  mode,
  nodeId,
  parentId,
  open,
  onClose,
  onSuccess,
  onError,
}) => {
  const { workingCopy, setWorkingCopy, init, commit, discard } = useWorkingCopy<LocationWorkingCopy>({ nodeType: 'location', mode, nodeId: nodeId as any, parentId: parentId as any });

  useEffect(() => { if (open) void init(); }, [open, init]);
  useEffect(() => { return () => { void discard().catch(() => {}); }; }, [discard]);

  const handleSave = async () => {
    try {
      await commit();
      if (workingCopy) onSuccess?.(workingCopy);
      notify.success('Location saved successfully');
    } catch (e) {
      onError?.(e as Error);
      notify.error('Failed to save location');
    } finally {
      onClose();
    }
  };

  const handleCancel = async () => { await discard().catch(() => {}); notify.info('Location changes discarded'); onClose(); };

  const updateWorkingCopy = (updates: Partial<LocationWorkingCopy>) => { setWorkingCopy((prev: LocationWorkingCopy) => ({ ...prev, ...updates } as LocationWorkingCopy)); };

  // Fallback object for initial render before WC loads
  const wc: LocationWorkingCopy = workingCopy ?? {
    name: '',
    description: '',
    dataSourceName: 'openstreetmap',
    licenseAgreement: false,
  } as LocationWorkingCopy;

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <LocationOn color="primary" />
          <Typography variant="h6">
            {mode === 'create' ? '地点情報ノードの作成' : '地点情報ノードの編集'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <TextField
            fullWidth
            required
            label="名前"
            value={wc.name}
            onChange={(e) => updateWorkingCopy({ name: e.target.value })}
            disabled={!workingCopy}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label="説明"
            value={wc.description || ''}
            onChange={(e) => updateWorkingCopy({ description: e.target.value })}
            disabled={!workingCopy}
            sx={{ mb: 3 }}
          />

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>データソース</InputLabel>
            <Select
              value={wc.dataSourceName}
              onChange={(e) => updateWorkingCopy({ dataSourceName: e.target.value as any })}
              label="データソース"
              disabled={!workingCopy}
            >
              <MenuItem value="openstreetmap">OpenStreetMap</MenuItem>
              <MenuItem value="geonames">GeoNames</MenuItem>
              <MenuItem value="wikidata">Wikidata</MenuItem>
              <MenuItem value="overpass">Overpass API</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={wc.licenseAgreement}
                onChange={(e) => updateWorkingCopy({ licenseAgreement: e.target.checked })}
                disabled={!workingCopy}
              />
            }
            label="ライセンスに同意する"
            sx={{ mb: 2 }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!workingCopy || !wc.name || !wc.licenseAgreement}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
