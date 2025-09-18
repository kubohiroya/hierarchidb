import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { MapLibreMap } from '@hierarchidb/ui-map';
import type { ResourceSummary } from './ResourcePicker.js';

export interface MapPreviewProps {
  items: ResourceSummary[];
}

export const MapPreview: React.FC<MapPreviewProps> = ({ items: _items }) => {
  // Compute a simple initial view (fallback to world)
  const initialView = useMemo(() => ({ longitude: 0, latitude: 0, zoom: 1 }), []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Preview of aggregated resources on the map (generalized).
      </Typography>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <MapLibreMap width="100%" height={420} initialViewState={initialView} mapStyle="https://demotiles.maplibre.org/style.json" />
      </Box>
    </Box>
  );
};
