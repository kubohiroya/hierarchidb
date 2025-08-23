/**
 * Project Dialog - Step 2: Map Configuration
 * Configure initial map view and rendering settings
 */

import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Slider,
  FormControlLabel,
  Switch,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  Button,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  MyLocation as MyLocationIcon,
} from '@mui/icons-material';
import { type CreateProjectData, DEFAULT_MAP_CONFIG, DEFAULT_RENDER_CONFIG, type MapConfiguration, type RenderConfiguration } from '../../types';

/**
 * Props for Step2MapConfiguration
 */
export interface Step2MapConfigurationProps {
  data: Partial<CreateProjectData>;
  onChange: (updates: Partial<CreateProjectData>) => void;
}

/**
 * Step 2: Map Configuration Component
 */
export const Step2MapConfiguration: React.FC<Step2MapConfigurationProps> = ({
  data,
  onChange,
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Get current map config with defaults
  const mapConfig = {
    ...DEFAULT_MAP_CONFIG,
    ...data.mapConfig,
  };

  // Get current render config with defaults
  const renderConfig = {
    ...DEFAULT_RENDER_CONFIG,
    ...data.renderConfig,
  };

  /**
   * Handle map config change
   */
  const handleMapConfigChange = useCallback((updates: Partial<MapConfiguration>) => {
    onChange({
      mapConfig: {
        ...mapConfig,
        ...updates,
      },
    });
  }, [mapConfig, onChange]);

  /**
   * Handle render config change
   */
  const handleRenderConfigChange = useCallback((updates: Partial<RenderConfiguration>) => {
    onChange({
      renderConfig: {
        ...renderConfig,
        ...updates,
      },
    });
  }, [renderConfig, onChange]);

  /**
   * Handle longitude change
   */
  const handleLongitudeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const longitude = parseFloat(event.target.value) || 0;
    handleMapConfigChange({
      center: [longitude, mapConfig.center[1]],
    });
  }, [mapConfig.center, handleMapConfigChange]);

  /**
   * Handle latitude change
   */
  const handleLatitudeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const latitude = parseFloat(event.target.value) || 0;
    handleMapConfigChange({
      center: [mapConfig.center[0], latitude],
    });
  }, [mapConfig.center, handleMapConfigChange]);

  /**
   * Handle zoom change
   */
  const handleZoomChange = useCallback((_: Event, value: number | number[]) => {
    handleMapConfigChange({ zoom: value as number });
  }, [handleMapConfigChange]);

  /**
   * Handle bearing change
   */
  const handleBearingChange = useCallback((_: Event, value: number | number[]) => {
    handleMapConfigChange({ bearing: value as number });
  }, [handleMapConfigChange]);

  /**
   * Handle pitch change
   */
  const handlePitchChange = useCallback((_: Event, value: number | number[]) => {
    handleMapConfigChange({ pitch: value as number });
  }, [handleMapConfigChange]);

  /**
   * Use current location
   */
  const handleUseCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleMapConfigChange({
            center: [position.coords.longitude, position.coords.latitude],
          });
        },
        (error) => {
          console.error('Failed to get current location:', error);
          // TODO: Show error notification
        }
      );
    }
  }, [handleMapConfigChange]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Map Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Configure the initial map view and rendering settings. These settings determine how your project will appear when first opened.
      </Typography>

      {/* Basic Map Settings */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Initial View
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Map Center */}
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Typography variant="subtitle2">
                  Map Center
                </Typography>
                <Button
                  size="small"
                  startIcon={<MyLocationIcon />}
                  onClick={handleUseCurrentLocation}
                >
                  Use Current Location
                </Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 200px' }}>
                  <TextField
                    label="Longitude"
                    type="number"
                    value={mapConfig.center[0]}
                    onChange={handleLongitudeChange}
                    fullWidth
                    size="small"
                    inputProps={{
                      min: -180,
                      max: 180,
                      step: 0.000001,
                    }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°</InputAdornment>,
                    }}
                  />
                </Box>
                <Box sx={{ flex: '1 1 200px' }}>
                  <TextField
                    label="Latitude"
                    type="number"
                    value={mapConfig.center[1]}
                    onChange={handleLatitudeChange}
                    fullWidth
                    size="small"
                    inputProps={{
                      min: -90,
                      max: 90,
                      step: 0.000001,
                    }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°</InputAdornment>,
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Zoom Level */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Zoom Level: {mapConfig.zoom}
              </Typography>
              <Slider
                value={mapConfig.zoom}
                onChange={handleZoomChange}
                min={0}
                max={22}
                step={0.1}
                marks={[
                  { value: 0, label: 'World' },
                  { value: 5, label: 'Country' },
                  { value: 10, label: 'City' },
                  { value: 15, label: 'Street' },
                  { value: 20, label: 'Building' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Accordion 
        expanded={advancedOpen} 
        onChange={(_, isExpanded) => setAdvancedOpen(isExpanded)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">
            Advanced Settings
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Map Rotation and Tilt Row */}
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 300px' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Bearing (Rotation): {mapConfig.bearing}°
                </Typography>
                <Slider
                  value={mapConfig.bearing}
                  onChange={handleBearingChange}
                  min={0}
                  max={360}
                  step={1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: 'N' },
                    { value: 90, label: 'E' },
                    { value: 180, label: 'S' },
                    { value: 270, label: 'W' },
                  ]}
                />
              </Box>

              <Box sx={{ flex: '1 1 300px' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Pitch (Tilt): {mapConfig.pitch}°
                </Typography>
                <Slider
                  value={mapConfig.pitch}
                  onChange={handlePitchChange}
                  min={0}
                  max={60}
                  step={1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: 'Flat' },
                    { value: 30, label: 'Angled' },
                    { value: 60, label: 'Steep' },
                  ]}
                />
              </Box>
            </Box>

            <Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Rendering Options
              </Typography>
            </Box>

            {/* Rendering Options Row */}
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 300px' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={renderConfig.pixelRatio > 1}
                      onChange={(event) => {
                        handleRenderConfigChange({
                          pixelRatio: event.target.checked ? window.devicePixelRatio || 2 : 1,
                        });
                      }}
                    />
                  }
                  label="High DPI Display"
                />
                <Typography variant="caption" display="block" color="text.secondary">
                  Enable for sharper display on high-resolution screens
                </Typography>
              </Box>

              <Box sx={{ flex: '1 1 300px' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={renderConfig.preserveDrawingBuffer}
                      onChange={(event) => {
                        handleRenderConfigChange({
                          preserveDrawingBuffer: event.target.checked,
                        });
                      }}
                    />
                  }
                  label="Enable Screenshots"
                />
                <Typography variant="caption" display="block" color="text.secondary">
                  Allow the map to be exported as images (may impact performance)
                </Typography>
              </Box>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default Step2MapConfiguration;