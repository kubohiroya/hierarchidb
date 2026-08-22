/**
 * @file BaseMapDisplay.tsx
 * @description BaseMap display component using MapLibre GL
 * Renders the configured basemap with all settings applied
 */

import type { NodeId } from '@hierarchidb/core-types';
// CrossViewSnackbar/useCrossHighlightSync pull tabular-store (node:module) into client bundle; disable for browser safety
// import { CrossViewSnackbar, useCrossHighlightSync } from '@hierarchidb/ui-grid';
import { loadMapLibreMap, type MapLibreMapInstance, type MapViewState } from '@hierarchidb/ui-map';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import type React from 'react';
import { lazy, Suspense } from 'react';
import type { BaseMapEntity } from '~/common/types/BaseMapEntity';
import { useBaseMapDisplay } from './useBaseMapDisplay.js';

export interface BaseMapDisplayProps {
  /** Node ID of the BaseMap entity */
  nodeId: NodeId;
  /** Optional entity data (if already loaded) */
  entity?: BaseMapEntity;
  /** Map container width */
  width?: string | number;
  /** Map container height */
  height?: string | number;
  /** Additional CSS styles */
  style?: React.CSSProperties;
  /** Callback when map loads */
  onLoad?: (map: MapLibreMapInstance) => void;
  /** Callback when view atoms changes */
  onViewStateChange?: (viewState: MapViewState) => void;
  /** Show loading indicator */
  showLoadingIndicator?: boolean;
  /** Interactive mode */
  interactive?: boolean;
  // Cross-view sync disabled in client bundle to avoid node:module
  datasetId?: string;
  bindLayerIds?: string[];
  bindSourceId?: string;
  enableDemoOverlay?: boolean;
}

const LazyMapLibreMap = lazy(async () => {
  const mod = await loadMapLibreMap();
  return { default: mod.MapLibreMap };
});

/**
 * BaseMap Display Component
 * Renders a MapLibre map with BaseMap entity configuration
 */
export const BaseMapDisplay: React.FC<BaseMapDisplayProps> = ({
  nodeId,
  entity: providedEntity,
  width = '100%',
  height = '400px',
  style,
  onLoad,
  onViewStateChange,
  showLoadingIndicator = true,
  interactive = true,
  datasetId,
  enableDemoOverlay = false,
}) => {
  const {
    entity,
    loading,
    error,
    initialViewState,
    mapStyleProps,
    handleMapLoad,
    handleViewStateChange,
  } = useBaseMapDisplay({
    nodeId,
    providedEntity,
    onLoad,
    onViewStateChange,
    datasetId,
    enableDemoOverlay,
  });

  if (loading && showLoadingIndicator) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width,
          height,
          ...style,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ width, height, p: 2, ...style }}>
        <Alert severity="error">
          <Typography variant="body2">{error}</Typography>
        </Alert>
      </Box>
    );
  }

  if (!entity || !initialViewState) {
    return (
      <Box sx={{ width, height, p: 2, ...style }}>
        <Alert severity="info">
          <Typography variant="body2">No map configuration available</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width, height, position: 'relative', ...style }}>
      <Suspense
        fallback={
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(247, 250, 252, 0.6)',
            }}
          >
            <CircularProgress size={32} />
          </Box>
        }
      >
        <LazyMapLibreMap
          initialViewState={initialViewState}
          {...mapStyleProps}
          width="100%"
          height="100%"
          onLoad={handleMapLoad}
          onViewStateChange={handleViewStateChange}
          mapOptions={{
            interactive,
            scrollZoom: interactive,
            dragPan: interactive,
            dragRotate: interactive,
            doubleClickZoom: interactive,
            touchZoomRotate: interactive,
          }}
        >
          {/* Children components like markers, layers etc. can be added here */}
        </LazyMapLibreMap>
      </Suspense>

      {/* Cross-view snackbar disabled to avoid node:module in browser bundle */}
    </Box>
  );
};
