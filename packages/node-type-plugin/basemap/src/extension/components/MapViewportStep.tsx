/**
 * @file MapViewportStep.tsx
 * @description Map Viewport step component for BaseMap extension dialog
 * Simplified to work with the plugin extension system
 */

import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Typography, 
  Grid, 
  Slider, 
  FormControl,
  FormLabel,
  Alert
} from '@mui/material';

export interface MapViewportStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

export const MapViewportStep: React.FC<MapViewportStepProps> = ({
  data,
  onNext,
  errors = []
}) => {
  const [center, setCenter] = useState<[number, number]>(
    data.viewport?.center || [139.6917, 35.6895] // Tokyo default
  );
  const [zoom, setZoom] = useState<number>(data.viewport?.zoom || 10);
  const [bearing, setBearing] = useState<number>(data.viewport?.bearing || 0);
  const [pitch, setPitch] = useState<number>(data.viewport?.pitch || 0);

  const updateViewport = (newCenter: [number, number], newZoom: number, newBearing: number, newPitch: number) => {
    const newData = {
      ...data,
      viewport: {
        center: newCenter,
        zoom: newZoom,
        bearing: newBearing,
        pitch: newPitch
      }
    };
    onNext(newData);
  };

  const handleCenterChange = (index: number, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const newCenter: [number, number] = [...center];
      newCenter[index] = numValue;
      setCenter(newCenter);
      updateViewport(newCenter, zoom, bearing, pitch);
    }
  };

  const handleZoomChange = (_: Event, value: number | number[]) => {
    const newZoom = typeof value === 'number' ? value : (value[0] ?? zoom);
    setZoom(newZoom);
    updateViewport(center, newZoom, bearing, pitch);
  };

  const handleBearingChange = (_: Event, value: number | number[]) => {
    const newBearing = typeof value === 'number' ? value : (value[0] ?? bearing);
    setBearing(newBearing);
    updateViewport(center, zoom, newBearing, pitch);
  };

  const handlePitchChange = (_: Event, value: number | number[]) => {
    const newPitch = typeof value === 'number' ? value : (value[0] ?? pitch);
    setPitch(newPitch);
    updateViewport(center, zoom, bearing, newPitch);
  };

  return (
    <Box sx={{ p: 2, maxWidth: 600 }}>
      <Typography variant="h6" gutterBottom>
        Configure Map Viewport
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Set the initial view position and orientation for your base map.
      </Typography>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            Center Coordinates
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Longitude"
                type="number"
                value={center[0]}
                onChange={(e) => handleCenterChange(0, e.target.value)}
                inputProps={{ step: 0.000001, min: -180, max: 180 }}
                helperText="Range: -180 to 180"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Latitude"
                type="number"
                value={center[1]}
                onChange={(e) => handleCenterChange(1, e.target.value)}
                inputProps={{ step: 0.000001, min: -90, max: 90 }}
                helperText="Range: -90 to 90"
              />
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth>
            <FormLabel>Zoom Level: {zoom}</FormLabel>
            <Slider
              value={zoom}
              onChange={handleZoomChange}
              min={0}
              max={24}
              step={0.1}
              marks={[
                { value: 0, label: '0' },
                { value: 6, label: '6' },
                { value: 12, label: '12' },
                { value: 18, label: '18' },
                { value: 24, label: '24' }
              ]}
              sx={{ mt: 2 }}
            />
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <FormLabel>Bearing: {bearing}°</FormLabel>
            <Slider
              value={bearing}
              onChange={handleBearingChange}
              min={0}
              max={360}
              step={1}
              marks={[
                { value: 0, label: 'N' },
                { value: 90, label: 'E' },
                { value: 180, label: 'S' },
                { value: 270, label: 'W' }
              ]}
              sx={{ mt: 2 }}
            />
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <FormLabel>Pitch: {pitch}°</FormLabel>
            <Slider
              value={pitch}
              onChange={handlePitchChange}
              min={0}
              max={60}
              step={1}
              marks={[
                { value: 0, label: '0°' },
                { value: 30, label: '30°' },
                { value: 60, label: '60°' }
              ]}
              sx={{ mt: 2 }}
            />
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
};