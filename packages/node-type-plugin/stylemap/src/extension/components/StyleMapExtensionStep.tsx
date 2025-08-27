/**
 * StyleMap extension step component for folder dialog
 */

import React, { useCallback } from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Typography,
  Box,
} from '@mui/material';

export interface StyleMapStepData {
  styleType?: 'choropleth' | 'heatmap' | 'points' | 'lines';
  dataSource?: string;
  colorScheme?: string;
  opacity?: number;
  strokeWidth?: number;
}

interface StyleMapExtensionStepProps {
  data: StyleMapStepData;
  onChange: (data: StyleMapStepData) => void;
  errors?: string[];
  isSubmitting?: boolean;
}

export const StyleMapExtensionStep: React.FC<StyleMapExtensionStepProps> = ({
  data,
  onChange,
  errors,
  isSubmitting,
}) => {
  const handleStyleTypeChange = useCallback(
    (event: any) => {
      onChange({ ...data, styleType: event.target.value });
    },
    [data, onChange]
  );

  const handleDataSourceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...data, dataSource: event.target.value });
    },
    [data, onChange]
  );

  const handleColorSchemeChange = useCallback(
    (event: any) => {
      onChange({ ...data, colorScheme: event.target.value });
    },
    [data, onChange]
  );

  const handleOpacityChange = useCallback(
    (_event: any, value: number | number[]) => {
      onChange({ ...data, opacity: value as number });
    },
    [data, onChange]
  );

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Configure StyleMap visualization settings for this folder
        </Typography>
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel>Style Type</InputLabel>
          <Select
            value={data.styleType || 'choropleth'}
            onChange={handleStyleTypeChange}
            label="Style Type"
          >
            <MenuItem value="choropleth">Choropleth Map</MenuItem>
            <MenuItem value="heatmap">Heat Map</MenuItem>
            <MenuItem value="points">Point Map</MenuItem>
            <MenuItem value="lines">Line Map</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Data Source"
          value={data.dataSource || ''}
          onChange={handleDataSourceChange}
          disabled={isSubmitting}
          placeholder="e.g., CSV file path or URL"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel>Color Scheme</InputLabel>
          <Select
            value={data.colorScheme || 'blues'}
            onChange={handleColorSchemeChange}
            label="Color Scheme"
          >
            <MenuItem value="blues">Blues</MenuItem>
            <MenuItem value="reds">Reds</MenuItem>
            <MenuItem value="greens">Greens</MenuItem>
            <MenuItem value="viridis">Viridis</MenuItem>
            <MenuItem value="plasma">Plasma</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Box>
          <Typography gutterBottom>
            Opacity: {data.opacity || 0.7}
          </Typography>
          <Slider
            value={data.opacity || 0.7}
            onChange={handleOpacityChange}
            min={0}
            max={1}
            step={0.1}
            marks
            disabled={isSubmitting}
          />
        </Box>
      </Grid>

      {errors && errors.length > 0 && (
        <Grid item xs={12}>
          <Typography color="error" variant="body2">
            {errors.join(', ')}
          </Typography>
        </Grid>
      )}
    </Grid>
  );
};

export default StyleMapExtensionStep;