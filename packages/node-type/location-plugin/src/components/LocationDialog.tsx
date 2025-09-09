/**
  * Location Dialog Component
   */

import React, { useState } from 'react';
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
import type { LocationDialogProps, LocationWorkingCopy, NodeId } from '../types';

export const LocationDialog: React.FC<LocationDialogProps> = ({
                                                                mode,
                                                                nodeId,
                                                                open,
                                                                onClose,
                                                              }) => {
  const [workingCopy, setWorkingCopy] = useState<LocationWorkingCopy>({
    id: 'temp' as any,
    nodeId: nodeId || 'temp' as NodeId,
    name: '',
    dataSourceName: 'openstreetmap',
    licenseAgreement: false,
    processingConfig: {
      concurrentDownloads: 2,
      enableLocationFiltering: false,
      enableClustering: false,
      enableGeocoding: false,
    },
    processingStatus: 'idle',
    checkboxState: {},
    selectedCountries: [],
    locationTypes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  });

  const handleSave = () => {
    // TODO: Implement save logic
    console.log('Saving location:', workingCopy);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const updateWorkingCopy = (updates: Partial<LocationWorkingCopy>) => {
    setWorkingCopy(prev => ({ ...prev, ...updates }));
  };

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
            value={workingCopy.name}
            onChange={(e) => updateWorkingCopy({ name: e.target.value })}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label="説明"
            value={workingCopy.description || ''}
            onChange={(e) => updateWorkingCopy({ description: e.target.value })}
            sx={{ mb: 3 }}
          />

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>データソース</InputLabel>
            <Select
              value={workingCopy.dataSourceName}
              onChange={(e) => updateWorkingCopy({ dataSourceName: e.target.value as any })}
              label="データソース"
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
                checked={workingCopy.licenseAgreement}
                onChange={(e) => updateWorkingCopy({ licenseAgreement: e.target.checked })}
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
          disabled={!workingCopy.name || !workingCopy.licenseAgreement}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};