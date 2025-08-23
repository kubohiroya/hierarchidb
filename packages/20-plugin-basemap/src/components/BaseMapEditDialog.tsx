/**
 * @file BaseMapEditDialog.tsx
 * @description BaseMap editing dialog using common components
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { CommonPluginDialog } from '@hierarchidb/11-ui-dialog';
import type { BaseMapEntity } from '../types';
import type { NodeId } from '@hierarchidb/00-core';

export interface BaseMapEditDialogProps {
  /**
   * ID of the basemap being edited
   */
  nodeId: NodeId;

  /**
   * Current basemap data
   */
  currentData: BaseMapEntity;

  /**
   * Called when user submits changes
   */
  onSubmit: (changes: Partial<BaseMapEntity>) => Promise<void>;

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
 * Dialog for editing existing basemaps
 */
export const BaseMapEditDialog: React.FC<BaseMapEditDialogProps> = ({
  nodeId,
  currentData,
  onSubmit,
  onCancel,
  open = true,
}) => {
  const [formData, setFormData] = useState<Partial<BaseMapEntity>>(currentData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Reset form when currentData changes
  useEffect(() => {
    setFormData(currentData);
    setErrors({});
    setIsDirty(false);
  }, [currentData]);

  // Check if data has changed
  const hasChanges = useCallback(() => {
    return JSON.stringify(formData) !== JSON.stringify(currentData);
  }, [formData, currentData]);



  // Update form data
  const handleFormDataChange = useCallback((newData: Partial<BaseMapEntity>) => {
    setFormData(newData);
    setIsDirty(hasChanges());
    // Clear related errors
    setErrors({});
  }, [hasChanges]);

  // Handle field change
  const handleFieldChange = useCallback((field: keyof BaseMapEntity, value: unknown) => {
    handleFormDataChange({ ...formData, [field]: value });
  }, [formData, handleFormDataChange]);

  // Specific handlers for different input types
  const handleTextFieldChange = useCallback((field: keyof BaseMapEntity) => 
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleFieldChange(field, e.target.value);
    }, [handleFieldChange]
  );

  const handleSelectChange = useCallback((field: keyof BaseMapEntity) => 
    (event: SelectChangeEvent<string>) => {
      handleFieldChange(field, event.target.value);
    }, [handleFieldChange]
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Calculate changes
    const changes: Partial<BaseMapEntity> = {};
    
    Object.keys(formData).forEach((key) => {
      const field = key as keyof BaseMapEntity;
      if (JSON.stringify(formData[field]) !== JSON.stringify(currentData[field])) {
        (changes as any)[field] = formData[field];
      }
    });

    // Only submit if there are actual changes
    if (Object.keys(changes).length > 0) {
      await onSubmit(changes);
    } else {
      onCancel();
    }
  }, [formData, currentData, onSubmit, onCancel]);

  // const _isValid = validateForm() && hasChanges();

  return (
    <CommonPluginDialog
      mode="edit"
      open={open}
      nodeId={nodeId}
      title="Edit BaseMap"
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
              onChange={(_: Event, value: number | number[]) => handleFieldChange('zoom', value as number)}
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
              onChange={(_: Event, value: number | number[]) => handleFieldChange('bearing', value as number)}
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
              onChange={(_: Event, value: number | number[]) => handleFieldChange('pitch', value as number)}
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

BaseMapEditDialog.displayName = 'BaseMapEditDialog';