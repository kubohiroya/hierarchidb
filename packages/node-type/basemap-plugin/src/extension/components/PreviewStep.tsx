/**
 * @file PreviewStep.tsx
 * @description Preview step component for BaseMap extension dialog
 * Shows a live preview of the configured basemap
 */

import React from 'react';
import { Box, Typography, Alert, Stack, List, ListItem, ListItemText } from '@mui/material';
import { BaseMapPreview } from '../../components/BaseMapPreview';

export interface PreviewStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  data,
  onNext: _onNext,
  onPrevious: _onPrevious,
  errors = []
}) => {
  // Extract configuration from data
  const mapStyle = data.mapStyle || { style: 'streets' };
  const viewport = data.viewport || {
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0
  };
  const displayOptions = data.displayOptions || {};

  // Check if configuration is complete
  const isConfigComplete = data.mapStyle && data.viewport;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Preview Your BaseMap
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review your basemap configuration. The preview below shows how your map will appear with the selected style and settings.
      </Typography>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </Alert>
      )}

      {!isConfigComplete ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Please complete the previous steps to see the preview.
        </Alert>
      ) : (
        <Stack spacing={3}>
          {/* Map Preview */}
          <BaseMapPreview
            mapStyle={mapStyle}
            viewport={viewport}
            displayOptions={displayOptions}
            height={400}
            showMetadata={true}
            interactive={true}
            title="Interactive Preview"
          />

          {/* Configuration Summary */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Configuration Summary
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Map Style"
                  secondary={
                    mapStyle.style === 'custom' && mapStyle.customStyleUrl
                      ? `Custom: ${mapStyle.customStyleUrl}`
                      : mapStyle.style.charAt(0).toUpperCase() + mapStyle.style.slice(1)
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Center Coordinates"
                  secondary={`${viewport.center[0].toFixed(4)}, ${viewport.center[1].toFixed(4)}`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Zoom Level"
                  secondary={viewport.zoom.toFixed(1)}
                />
              </ListItem>
              {(viewport.bearing !== 0 || viewport.pitch !== 0) && (
                <ListItem>
                  <ListItemText
                    primary="Camera Angle"
                    secondary={`Bearing: ${viewport.bearing}°, Pitch: ${viewport.pitch}°`}
                  />
                </ListItem>
              )}
              {displayOptions.tags && displayOptions.tags.length > 0 && (
                <ListItem>
                  <ListItemText
                    primary="Tags"
                    secondary={displayOptions.tags.join(', ')}
                  />
                </ListItem>
              )}
            </List>
          </Box>

          {/* Instructions */}
          <Alert severity="info">
            <Typography variant="body2">
              You can interact with the map above to test the configuration:
            </Typography>
            <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
              <li>Click and drag to pan</li>
              <li>Scroll to zoom in/out</li>
              <li>Right-click and drag to rotate</li>
              <li>Hold Ctrl/Cmd and drag to change pitch</li>
            </ul>
          </Alert>
        </Stack>
      )}
    </Box>
  );
};