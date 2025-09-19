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
import type { SelectChangeEvent } from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import { notify } from '@hierarchidb/ui-core';
import type { LocationDialogProps, LocationWorkingCopy } from '../types/index.js';
import { useWorkingCopy } from '@hierarchidb/ui-core';

const toIdString = (value?: LocationDialogProps['nodeId']): string | undefined =>
  value ? `${value}` : undefined;

const dataSourceOptions = ['openstreetmap', 'geonames', 'wikidata', 'overpass'] as const;
type DataSourceName = typeof dataSourceOptions[number];

const dataSourceLabels: Record<DataSourceName, string> = {
  openstreetmap: 'OpenStreetMap',
  geonames: 'GeoNames',
  wikidata: 'Wikidata',
  overpass: 'Overpass API',
};

const isDataSourceName = (value: string): value is DataSourceName =>
  (dataSourceOptions as readonly string[]).includes(value);

export const LocationDialog: React.FC<LocationDialogProps> = ({
  mode,
  nodeId,
  parentId,
  open,
  onClose,
  onSuccess,
  onError,
}) => {
  const { workingCopy, setWorkingCopy, init, commit, discard } = useWorkingCopy<LocationWorkingCopy>({
    nodeType: 'location',
    mode,
    nodeId: toIdString(nodeId),
    parentId: toIdString(parentId),
  });

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

  const updateWorkingCopy = (updates: Partial<LocationWorkingCopy>) => {
    setWorkingCopy((prev) => ({ ...prev, ...updates }));
  };

  const dataSourceValue: DataSourceName = workingCopy?.dataSourceName ?? 'openstreetmap';
  const handleDataSourceChange = (event: SelectChangeEvent<DataSourceName>) => {
    const nextValue = event.target.value;
    if (isDataSourceName(nextValue)) updateWorkingCopy({ dataSourceName: nextValue });
  };

  const nameValue = workingCopy?.name ?? '';
  const descriptionValue = workingCopy?.description ?? '';
  const licenseAgreementValue = workingCopy?.licenseAgreement ?? false;

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
            value={nameValue}
            onChange={(e) => updateWorkingCopy({ name: e.target.value })}
            disabled={!workingCopy}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label="説明"
            value={descriptionValue}
            onChange={(e) => updateWorkingCopy({ description: e.target.value })}
            disabled={!workingCopy}
            sx={{ mb: 3 }}
          />

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>データソース</InputLabel>
            <Select<DataSourceName>
              value={dataSourceValue}
              onChange={handleDataSourceChange}
              label="データソース"
              disabled={!workingCopy}
            >
              {dataSourceOptions.map((value) => (
                <MenuItem key={value} value={value}>
                  {dataSourceLabels[value]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={licenseAgreementValue}
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
          disabled={!workingCopy || !nameValue || !licenseAgreementValue}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
