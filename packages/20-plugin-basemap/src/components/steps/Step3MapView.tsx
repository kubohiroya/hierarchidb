/**
 * @file Step3MapView.tsx
 * @description Map view configuration step for BaseMap creation
 */

import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  FormControlLabel,
  Switch,
  Slider,
  Paper,
} from '@mui/material';
import type { BaseMapEntity } from '../../types';

export interface Step3MapViewProps {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  displayOptions: BaseMapEntity['displayOptions'];
  onCenterChange: (center: [number, number]) => void;
  onZoomChange: (zoom: number) => void;
  onBearingChange: (bearing: number) => void;
  onPitchChange: (pitch: number) => void;
  onDisplayOptionsChange: (options: BaseMapEntity['displayOptions']) => void;
}

export const Step3MapView: React.FC<Step3MapViewProps> = ({
  center,
  zoom,
  bearing,
  pitch,
  displayOptions,
  onCenterChange,
  onZoomChange,
  onBearingChange,
  onPitchChange,
  onDisplayOptionsChange,
}) => {
  const handleCoordinateChange = (index: 0 | 1, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const newCenter: [number, number] = [...center];
      newCenter[index] = numValue;
      onCenterChange(newCenter);
    }
  };

  const handleDisplayOptionChange = (option: keyof NonNullable<BaseMapEntity['displayOptions']>) => {
    return (checked: boolean) => {
      onDisplayOptionsChange({
        ...displayOptions,
        [option]: checked,
      });
    };
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Map View Settings
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure the initial view and display options for your map.
      </Typography>

      <Grid container spacing={3}>
        {/* Map Center */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            Map Center
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Longitude"
                type="number"
                value={center[0]}
                onChange={(e) => handleCoordinateChange(0, e.target.value)}
                inputProps={{ min: -180, max: 180, step: 0.000001 }}
                helperText="East-West position (-180 to 180)"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Latitude"
                type="number"
                value={center[1]}
                onChange={(e) => handleCoordinateChange(1, e.target.value)}
                inputProps={{ min: -90, max: 90, step: 0.000001 }}
                helperText="North-South position (-90 to 90)"
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Zoom Level */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            Zoom Level: {zoom}
          </Typography>
          <Slider
            value={zoom}
            onChange={(_e, value) => onZoomChange(value as number)}
            min={0}
            max={22}
            step={0.1}
            marks={[
              { value: 0, label: '0' },
              { value: 5, label: '5' },
              { value: 10, label: '10' },
              { value: 15, label: '15' },
              { value: 22, label: '22' },
            ]}
            sx={{ mt: 2 }}
          />
        </Grid>

        {/* Bearing */}
        <Grid item xs={12} sm={6}>
          <Typography variant="subtitle1" gutterBottom>
            Bearing: {bearing}°
          </Typography>
          <Slider
            value={bearing}
            onChange={(_e, value) => onBearingChange(value as number)}
            min={0}
            max={360}
            step={1}
            marks={[
              { value: 0, label: 'N' },
              { value: 90, label: 'E' },
              { value: 180, label: 'S' },
              { value: 270, label: 'W' },
            ]}
            sx={{ mt: 2 }}
          />
        </Grid>

        {/* Pitch */}
        <Grid item xs={12} sm={6}>
          <Typography variant="subtitle1" gutterBottom>
            Pitch: {pitch}°
          </Typography>
          <Slider
            value={pitch}
            onChange={(_e, value) => onPitchChange(value as number)}
            min={0}
            max={60}
            step={1}
            marks={[
              { value: 0, label: '0°' },
              { value: 30, label: '30°' },
              { value: 60, label: '60°' },
            ]}
            sx={{ mt: 2 }}
          />
        </Grid>

        {/* Display Options */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Display Options
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(displayOptions?.show3dBuildings)}
                      onChange={(e) => handleDisplayOptionChange('show3dBuildings')(e.target.checked)}
                    />
                  }
                  label="3D Buildings"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(displayOptions?.showTraffic)}
                      onChange={(e) => handleDisplayOptionChange('showTraffic')(e.target.checked)}
                    />
                  }
                  label="Traffic"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(displayOptions?.showTransit)}
                      onChange={(e) => handleDisplayOptionChange('showTransit')(e.target.checked)}
                    />
                  }
                  label="Transit"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(displayOptions?.showTerrain)}
                      onChange={(e) => handleDisplayOptionChange('showTerrain')(e.target.checked)}
                    />
                  }
                  label="Terrain"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={displayOptions?.showLabels !== false}
                      onChange={(e) => handleDisplayOptionChange('showLabels')(e.target.checked)}
                    />
                  }
                  label="Labels"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};