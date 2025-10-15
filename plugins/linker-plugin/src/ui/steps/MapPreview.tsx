import type React from 'react';
import { Suspense, lazy, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { loadMapLibreMap } from '@hierarchidb/ui-map';
import type { ResourceSummary } from './ResourcePicker.js';

export interface MapPreviewProps {
  items: ResourceSummary[];
}

const LazyMapLibreMap = lazy(async () => {
  const mod = await loadMapLibreMap();
  return { default: mod.MapLibreMap };
});

export const MapPreview: React.FC<MapPreviewProps> = ({ items: _items }) => {
  // Compute a simple initial view (fallback to world)
  const initialView = useMemo(() => ({ longitude: 0, latitude: 0, zoom: 1 }), []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Preview of aggregated resources on the map (generalized).
      </Typography>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <Suspense
          fallback={
            <Box
              sx={{
                width: '100%',
                height: 420,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(247,250,252,0.6)',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Loading map preview…
              </Typography>
            </Box>
          }
        >
          <LazyMapLibreMap
            width="100%"
            height={420}
            initialViewState={initialView}
            mapStyle="https://demotiles.maplibre.org/style.json"
            mapOptions={{
              interactive: false,
              scrollZoom: false,
              dragPan: false,
              dragRotate: false,
              doubleClickZoom: false,
              touchZoomRotate: false,
            }}
          />
        </Suspense>
      </Box>
    </Box>
  );
};
