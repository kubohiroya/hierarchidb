/**
 * @file BaseMapDisplay.tsx
 * @description BaseMap display component using MapLibre GL
 * Renders the configured basemap with all settings applied
 */

import type { NodeId } from '@hierarchidb/common-types';
// CrossViewSnackbar/useCrossHighlightSync pull tabular-store (node:module) into client bundle; disable for browser safety
// import { CrossViewSnackbar, useCrossHighlightSync } from '@hierarchidb/ui-grid';
import {
  loadMapLibreMap,
  type MapLibreMapInstance,
  type MapLibreStyle,
  type MapViewState,
} from '@hierarchidb/ui-map';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import type React from 'react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUILT_IN_STYLES } from '../../common/constants/builtInStyles.js';
import type { BaseMapEntity } from '../../common/types/BaseMapEntity.js';
import { useBaseMapEntity } from '../hooks/useBaseMapEntity.js';
import { resolveMapStyleSource } from '../utils/mapStyle.js';

interface DemoFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    properties: { name: string; nodeType: string };
    geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  }>;
}

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
  /** Callback when view state changes */
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
  const shouldFetch = !providedEntity && Boolean(nodeId);
  const {
    entity: fetchedEntity,
    loading: remoteLoading,
    error: remoteError,
  } = useBaseMapEntity(shouldFetch ? nodeId : null, {
    skip: !shouldFetch,
  });

  const entity = providedEntity ?? fetchedEntity ?? undefined;
  const [loading, setLoading] = useState(!providedEntity);
  const [error, setError] = useState<string | null>(null);
  const [_mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const unbindRef = useRef<null | (() => void)>(null);

  void datasetId;

  useEffect(() => {
    if (providedEntity) {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(remoteLoading);
    setError(remoteError ? remoteError.message ?? 'Failed to load map configuration' : null);
  }, [providedEntity, remoteLoading, remoteError]);

  // Convert entity viewport to MapLibre view state
  const initialViewState = useMemo<MapViewState | undefined>(() => {
    // Use viewport configuration
    if (!entity?.viewport) return undefined;

    return {
      longitude: entity.viewport.center[0],
      latitude: entity.viewport.center[1],
      zoom: entity.viewport.zoom,
      bearing: entity.viewport.bearing || 0,
      pitch: entity.viewport.pitch || 0,
    };
  }, [entity]);

  // Get map style URL based on configuration
  const mapStyleSource = useMemo<string | MapLibreStyle>(() => {
    if (!entity?.mapStyle) {
      return BUILT_IN_STYLES.streets.url;
    }
    return resolveMapStyleSource(entity.mapStyle);
  }, [entity?.mapStyle]);

  // Handle map load event
  const handleMapLoad = useCallback(
    (map: MapLibreMapInstance) => {
      setMapInstance(map);

      map.once('styledata', () => {
        if (!enableDemoOverlay) return;
        const c = {
          lng: entity?.viewport?.center?.[0] ?? 0,
          lat: entity?.viewport?.center?.[1] ?? 0,
        } as { lng: number; lat: number };
        const dx = 0.05,
          dy = 0.03;
        const mkPoly = (cx: number, cy: number, w: number, h: number): [number, number][] => [
          [cx - w, cy - h],
          [cx + w, cy - h],
          [cx + w, cy + h],
          [cx - w, cy + h],
          [cx - w, cy - h],
        ];
        const demoData: DemoFeatureCollection = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 'demo-1',
              properties: { name: 'Demo Area A', nodeType: 'basemap' },
              geometry: { type: 'Polygon', coordinates: [mkPoly(c.lng - 0.08, c.lat, dx, dy)] },
            },
            {
              type: 'Feature',
              id: 'demo-2',
              properties: { name: 'Demo Area B', nodeType: 'basemap' },
              geometry: { type: 'Polygon', coordinates: [mkPoly(c.lng + 0.08, c.lat, dx, dy)] },
            },
          ],
        };
        if (!map.getSource('demo-source')) {
          map.addSource('demo-source', { type: 'geojson', data: demoData });
        }
        if (!map.getLayer('demo-fill')) {
          map.addLayer({
            id: 'demo-fill',
            type: 'fill',
            source: 'demo-source',
            paint: {
              'fill-color': [
                'case',
                ['to-boolean', ['features-state', 'selected']],
                '#1976d2',
                ['to-boolean', ['features-state', 'hovered']],
                '#64b5f6',
                '#3f51b5',
              ],
              'fill-opacity': 0.25,
            },
          });
        }
        if (!map.getLayer('demo-outline')) {
          map.addLayer({
            id: 'demo-outline',
            type: 'line',
            source: 'demo-source',
            paint: {
              'line-color': [
                'case',
                ['to-boolean', ['features-state', 'selected']],
                '#0d47a1',
                ['to-boolean', ['features-state', 'hovered']],
                '#1976d2',
                '#283593',
              ],
              'line-width': [
                'case',
                ['to-boolean', ['features-state', 'selected']],
                3,
                ['to-boolean', ['features-state', 'hovered']],
                2.5,
                2,
              ],
            },
          });
        }
      });

      // Call parent callback
      onLoad?.(map);
    },
    [
      enableDemoOverlay,
      entity?.viewport?.center,
      onLoad,
    ]
  );

  useEffect(() => {
    if (!_mapInstance) return;
    const unbind = unbindRef.current;
    return () => {
      unbind?.();
    };
  }, [_mapInstance]);

  // Handle view state changes
  const handleViewStateChange = useCallback(
    (viewState: MapViewState) => {
      // Could update entity here if needed
      onViewStateChange?.(viewState);
    },
    [onViewStateChange]
  );

  // Loading state
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

  // Error state
  if (error) {
    return (
      <Box sx={{ width, height, p: 2, ...style }}>
        <Alert severity="error">
          <Typography variant="body2">{error}</Typography>
        </Alert>
      </Box>
    );
  }

  // No entity state
  if (!entity || !initialViewState) {
    return (
      <Box sx={{ width, height, p: 2, ...style }}>
        <Alert severity="info">
          <Typography variant="body2">No map configuration available</Typography>
        </Alert>
      </Box>
    );
  }

  const mapStyleProps = typeof mapStyleSource === 'string'
    ? { mapStyleUrl: mapStyleSource }
    : { mapStyleObject: mapStyleSource };

  // Render map
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
