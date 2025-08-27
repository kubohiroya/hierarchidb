/**
 * @file MapStyleStep.tsx
 * @description Map Style step component for BaseMap extension dialog
 * Simplified to work with the plugin extension system
 */

import React, { useState } from 'react';
import { 
  Box, 
  FormControl, 
  FormLabel, 
  RadioGroup, 
  FormControlLabel, 
  Radio, 
  TextField, 
  Typography,
  Alert
} from '@mui/material';

export interface MapStyleStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

const MAP_STYLE_OPTIONS = [
  { value: 'streets', label: 'Streets', description: 'Standard street map view' },
  { value: 'satellite', label: 'Satellite', description: 'Satellite imagery view' },
  { value: 'terrain', label: 'Terrain', description: 'Topographical terrain view' },
  { value: 'dark', label: 'Dark', description: 'Dark theme for low-light viewing' },
  { value: 'light', label: 'Light', description: 'Clean light theme' },
  { value: 'custom', label: 'Custom', description: 'Use custom MapLibre style URL' }
];

export const MapStyleStep: React.FC<MapStyleStepProps> = ({
  data,
  onNext,
  errors = []
}) => {
  const [mapStyle, setMapStyle] = useState(data.mapStyle?.style || 'streets');
  const [customStyleUrl, setCustomStyleUrl] = useState(data.mapStyle?.customStyleUrl || '');

  const handleStyleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newStyle = event.target.value;
    setMapStyle(newStyle);
    
    const newData = {
      ...data,
      mapStyle: {
        ...data.mapStyle,
        style: newStyle,
        customStyleUrl: newStyle === 'custom' ? customStyleUrl : undefined
      }
    };
    onNext(newData);
  };

  const handleCustomUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value;
    setCustomStyleUrl(url);
    
    if (mapStyle === 'custom') {
      const newData = {
        ...data,
        mapStyle: {
          ...data.mapStyle,
          style: 'custom',
          customStyleUrl: url
        }
      };
      onNext(newData);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 600 }}>
      <Typography variant="h6" gutterBottom>
        Choose Map Style
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select the visual style for your base map. You can choose from predefined styles or use a custom MapLibre style URL.
      </Typography>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </Alert>
      )}

      <FormControl component="fieldset" sx={{ width: '100%' }}>
        <FormLabel component="legend">Map Style</FormLabel>
        <RadioGroup
          value={mapStyle}
          onChange={handleStyleChange}
          sx={{ mt: 1 }}
        >
          {MAP_STYLE_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">{option.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </Box>
              }
              sx={{ mb: 1, alignItems: 'flex-start' }}
            />
          ))}
        </RadioGroup>
      </FormControl>

      {mapStyle === 'custom' && (
        <TextField
          fullWidth
          label="Custom Style URL"
          value={customStyleUrl}
          onChange={handleCustomUrlChange}
          placeholder="https://example.com/style.json"
          helperText="Enter a valid MapLibre GL JS style URL"
          sx={{ mt: 3 }}
          error={mapStyle === 'custom' && !customStyleUrl && errors.some(e => e.includes('Custom style URL'))}
        />
      )}
    </Box>
  );
};