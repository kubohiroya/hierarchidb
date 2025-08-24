/**
 * @file Step2MapStyle.tsx
 * @description Map style selection step for BaseMap creation
 */

import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  FormLabel,
  TextField,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import type { BaseMapEntity } from '../../types';

export interface Step2MapStyleProps {
  mapStyle: BaseMapEntity['mapStyle'];
  styleUrl?: string;
  apiKey?: string;
  onMapStyleChange: (style: BaseMapEntity['mapStyle']) => void;
  onStyleUrlChange: (url: string) => void;
  onApiKeyChange: (key: string) => void;
}

const styleOptions = [
  {
    value: 'streets' as const,
    label: 'Streets',
    description: 'Standard street map with roads, labels, and POIs',
    preview: '🗺️',
  },
  {
    value: 'satellite' as const,
    label: 'Satellite',
    description: 'Satellite imagery for aerial view',
    preview: '🛰️',
  },
  {
    value: 'hybrid' as const,
    label: 'Hybrid',
    description: 'Satellite imagery with street labels overlay',
    preview: '🗾',
  },
  {
    value: 'terrain' as const,
    label: 'Terrain',
    description: 'Topographic map showing elevation and terrain',
    preview: '🏔️',
  },
  {
    value: 'custom' as const,
    label: 'Custom',
    description: 'Use custom map style URL',
    preview: '⚙️',
  },
];

export const Step2MapStyle: React.FC<Step2MapStyleProps> = ({
  mapStyle,
  styleUrl,
  apiKey,
  onMapStyleChange,
  onStyleUrlChange,
  onApiKeyChange,
}) => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Map Style
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose the visual style for your base map.
      </Typography>

      <FormControl component="fieldset" sx={{ width: '100%' }}>
        <FormLabel component="legend">Style Type</FormLabel>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {styleOptions.map((option) => (
            <Grid item xs={12} sm={6} md={4} key={option.value}>
              <Card 
                variant={mapStyle === option.value ? 'elevation' : 'outlined'}
                sx={{ 
                  cursor: 'pointer',
                  border: mapStyle === option.value ? 2 : 1,
                  borderColor: mapStyle === option.value ? 'primary.main' : 'divider',
                }}
                onClick={() => onMapStyleChange(option.value)}
              >
                <CardContent sx={{ textAlign: 'center', p: 2 }}>
                  <Typography variant="h2" sx={{ mb: 1 }}>
                    {option.preview}
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {option.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </FormControl>

      {mapStyle === 'custom' && (
        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="Custom Style URL"
            value={styleUrl || ''}
            onChange={(e) => onStyleUrlChange(e.target.value)}
            placeholder="https://example.com/style.json"
            helperText="MapLibre GL style JSON URL or Mapbox style URL"
          />
        </Box>
      )}

      <Box sx={{ mt: 3 }}>
        <TextField
          fullWidth
          label="API Key (Optional)"
          value={apiKey || ''}
          onChange={(e) => onApiKeyChange(e.target.value)}
          type="password"
          placeholder="Enter API key for map tiles"
          helperText="Required for some map providers like Mapbox, OpenMapTiles, etc."
        />
      </Box>
    </Box>
  );
};