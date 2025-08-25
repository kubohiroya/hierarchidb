/**
 * @file BaseMapCreateDialog.tsx
 * @description BaseMap creation dialog using common components
 */

import React, { useState, useCallback } from 'react';
import {
  TextField,
  Grid,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormControl,
  InputLabel,
  Typography,
  Slider,
  Box,
} from '@mui/material';
import { Map as MapIcon } from '@mui/icons-material';
import { CommonPluginDialog } from '@hierarchidb/ui-dialog';
import type { BaseMapEntity } from '../types';
import type { NodeId } from '@hierarchidb/common-core';
import { DEFAULT_MAP_CONFIG } from '../types';

export interface BaseMapCreateDialogProps {
  /**
   * Parent node where the basemap will be created
   */
  parentId: NodeId;

  /**
   * Called when user submits the form
   */
  onSubmit: (data: Partial<BaseMapEntity>) => Promise<void>;

  /**
   * Called when user cancels the dialog
   */
  onCancel: () => void;

  /**
   * Whether the dialog is open
   */
  open?: boolean;
}

/**
 * Dialog for creating new basemaps
 */
export const BaseMapCreateDialog: React.FC<BaseMapCreateDialogProps> = ({
  parentId,
  onSubmit,
  onCancel,
  open = true,
}) => {
  const [formData, setFormData] = useState<Partial<BaseMapEntity>>({
    name: '',
    mapStyle: DEFAULT_MAP_CONFIG.mapStyle,
    center: DEFAULT_MAP_CONFIG.center,
    zoom: DEFAULT_MAP_CONFIG.zoom,
    bearing: DEFAULT_MAP_CONFIG.bearing,
    pitch: DEFAULT_MAP_CONFIG.pitch,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Validate form data
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }

    if (formData.center) {
      const [lng, lat] = formData.center;
      if (lng < -180 || lng > 180) {
        newErrors.center = 'Longitude must be between -180 and 180';
      }
      if (lat < -90 || lat > 90) {
        newErrors.center = 'Latitude must be between -90 and 90';
      }
    }

    if (formData.zoom !== undefined) {
      if (formData.zoom < 0 || formData.zoom > 22) {
        newErrors.zoom = 'Zoom must be between 0 and 22';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Update form data
  const handleFormDataChange = useCallback((newData: Partial<BaseMapEntity>) => {
    setFormData(newData);
    setIsDirty(true);
    // Clear related errors
    setErrors({});
  }, []);

  // Handle field change
  const handleFieldChange = useCallback(
    (field: keyof BaseMapEntity, value: any) => {
      handleFormDataChange({ ...formData, [field]: value });
    },
    [formData, handleFormDataChange]
  );

  // Specific handlers for different input types
  const handleTextFieldChange = useCallback(
    (field: keyof BaseMapEntity) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        handleFieldChange(field, e.target.value);
      },
    [handleFieldChange]
  );

  const handleSelectChange = useCallback(
    (field: keyof BaseMapEntity) => (event: SelectChangeEvent<string>) => {
      handleFieldChange(field, event.target.value);
    },
    [handleFieldChange]
  );

  const isValid = validateForm();

  const handleSubmit = useCallback(async () => {
    if (isValid) {
      await onSubmit(formData);
    }
  }, [formData, onSubmit, isValid]);

  return (
    <CommonPluginDialog
      mode="create"
      open={open}
      parentId={parentId}
      title="Create New BaseMap"
      icon={<MapIcon />}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      hasUnsavedChanges={isDirty}
      maxWidth="md"
    >
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            autoFocus
            fullWidth
            label="Name"
            value={formData.name}
            onChange={handleTextFieldChange('name')}
            error={!!errors.name}
            helperText={errors.name || 'Enter a name for the basemap'}
            required
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Map Style</InputLabel>
            <Select
              value={formData.mapStyle}
              onChange={handleSelectChange('mapStyle')}
              label="Map Style"
            >
              <MenuItem value="streets">Streets</MenuItem>
              <MenuItem value="satellite">Satellite</MenuItem>
              <MenuItem value="hybrid">Hybrid</MenuItem>
              <MenuItem value="terrain">Terrain</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box>
            <Typography gutterBottom>Zoom Level: {formData.zoom?.toFixed(1)}</Typography>
            <Slider
              value={formData.zoom || 10}
              onChange={(_: Event, value: number | number[]) =>
                handleFieldChange('zoom', value as number)
              }
              min={0}
              max={22}
              step={0.1}
              marks={[
                { value: 0, label: '0' },
                { value: 11, label: '11' },
                { value: 22, label: '22' },
              ]}
            />
            {errors.zoom && (
              <Typography color="error" variant="caption">
                {errors.zoom}
              </Typography>
            )}
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Center Coordinates
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Longitude"
                value={formData.center?.[0] || 0}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  handleFieldChange('center', [
                    parseFloat(e.target.value) || 0,
                    formData.center?.[1] || 0,
                  ])
                }
                inputProps={{ step: 0.000001, min: -180, max: 180 }}
                error={!!errors.center}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Latitude"
                value={formData.center?.[1] || 0}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  handleFieldChange('center', [
                    formData.center?.[0] || 0,
                    parseFloat(e.target.value) || 0,
                  ])
                }
                inputProps={{ step: 0.000001, min: -90, max: 90 }}
                error={!!errors.center}
              />
            </Grid>
            {errors.center && (
              <Grid item xs={12}>
                <Typography color="error" variant="caption">
                  {errors.center}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box>
            <Typography gutterBottom>Bearing: {formData.bearing}°</Typography>
            <Slider
              value={formData.bearing || 0}
              onChange={(_: Event, value: number | number[]) =>
                handleFieldChange('bearing', value as number)
              }
              min={0}
              max={360}
              step={1}
              marks={[
                { value: 0, label: 'N' },
                { value: 90, label: 'E' },
                { value: 180, label: 'S' },
                { value: 270, label: 'W' },
                { value: 360, label: 'N' },
              ]}
            />
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box>
            <Typography gutterBottom>Pitch: {formData.pitch}°</Typography>
            <Slider
              value={formData.pitch || 0}
              onChange={(_: Event, value: number | number[]) =>
                handleFieldChange('pitch', value as number)
              }
              min={0}
              max={60}
              step={1}
              marks={[
                { value: 0, label: '0°' },
                { value: 30, label: '30°' },
                { value: 60, label: '60°' },
              ]}
            />
          </Box>
        </Grid>
      </Grid>
    </CommonPluginDialog>
  );
};

BaseMapCreateDialog.displayName = 'BaseMapCreateDialog';
