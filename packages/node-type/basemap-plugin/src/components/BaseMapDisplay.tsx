/**
 * @file BaseMapDisplay.tsx
 * @description BaseMap display component using MapLibre GL
 * Renders the configured basemap with all settings applied
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import {
  type MapLibreLayer,
  MapLibreMap,
  type MapLibreMapInstance,
  type MapLibreStyle,
  type MapViewState,
} from '@hierarchidb/ui-map';
import type { NodeId } from '@hierarchidb/common-type';
import type { BaseMapEntity } from '../types/BaseMapEntity';
import { BaseMapEntityHandler } from '../handlers/BaseMapEntityHandler';
import { BUILT_IN_STYLES } from '../constants/builtInStyles';
import { CrossViewSnackbar, useCrossHighlightSync, useMapLibreFeatureState, ensureDefaultStyles } from '@hierarchidb/ui-core';

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
  /** Optional datasetId for cross-view highlight channel (defaults to `basemap:${nodeId}`) */
  datasetId?: string;
  /** Optional: bind MapLibre events to these layers for cross-highlight */
  bindLayerIds?: string[];
  /** Optional: MapLibre source id to apply feature-state updates */
  bindSourceId?: string;
  /** Optional: show a minimal demo overlay (local GeoJSON) for hover/select showcasing */
  enableDemoOverlay?: boolean;
}

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
                                                                bindLayerIds,
                                                                bindSourceId,
                                                                enableDemoOverlay = false,
                                                              }) => {
  const [entity, setEntity] = useState<BaseMapEntity | undefined>(providedEntity);
  const [loading, setLoading] = useState(!providedEntity);
  const [error, setError] = useState<string | null>(null);
  const [_mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const unbindRef = useRef<null | (() => void)>(null);

  const dsId = useMemo(() => datasetId ?? `basemap:${nodeId}`, [datasetId, nodeId]);
  const { bindMapLibre } = useCrossHighlightSync({ datasetId: dsId, withDeckAccessors: false });
  useMapLibreFeatureState({ datasetId: dsId, map: _mapInstance as any, sourceId: bindSourceId || '', throttleMs: 16 });
  // Also mirror demo overlay feature-state if enabled
  useMapLibreFeatureState({ datasetId: dsId, map: _mapInstance as any, sourceId: 'demo-source', throttleMs: 16 });
  // Default styles for hover/select
  useEffect(() => {
    try { ensureDefaultStyles(dsId, { includeRow: false, includeMap: true }); } catch {}
  }, [dsId]);

  // Fetch entity if not provided
  useEffect(() => {
    if (!providedEntity && nodeId) {
      const handler = new BaseMapEntityHandler();
      setLoading(true);
      handler.getEntityByNodeId(nodeId)
        .then((data) => {
          if (data) {
            setEntity(data || undefined);
            setError(null);
          } else {
            setError('BaseMap entity not found');
          }
        })
        .catch((err) => {
          console.error('Failed to load BaseMap entity:', err);
          setError('Failed to load map configuration');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [nodeId, providedEntity]);

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
  const mapStyleUrl = useMemo<string | MapLibreStyle>(() => {
    if (!entity?.mapStyle) {
      return BUILT_IN_STYLES.streets.url; // Default style
    }

    const { style, customStyleUrl, customStyleConfig } = entity.mapStyle;

    // Custom URL takes precedence
    if (style === 'custom' && customStyleUrl) {
      return customStyleUrl;
    }

    // Custom config (return as object, not URL)
    if (style === 'custom' && customStyleConfig) {
      return customStyleConfig as MapLibreStyle;
    }

    // Built-in style
    if (style !== 'custom') {
      const builtInStyle = BUILT_IN_STYLES[style as keyof typeof BUILT_IN_STYLES];
      if (builtInStyle) {
        return builtInStyle.url;
      }
    }

    // Fallback to default
    return BUILT_IN_STYLES.streets.url;
  }, [entity]);

  // Handle map load event
  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    setMapInstance(map);

    // Apply display options
    if (entity?.displayOptions) {
      const {
        show3dBuildings,
        showTerrain,
        showLabels,
      } = entity.displayOptions;
      // Note: showTraffic and showTransit depend on the specific map style
      // and may not be available in all styles

      // Wait for style to load
      map.once('styledata', () => {
        // Toggle 3D buildings
        if (show3dBuildings && map.getLayer('building-3d')) {
          map.setLayoutProperty('building-3d', 'visibility', 'visible');
        } else if (!show3dBuildings && map.getLayer('building-3d')) {
          map.setLayoutProperty('building-3d', 'visibility', 'none');
        }

        // Toggle labels
        const labelLayers = map.getStyle().layers.filter((layer: MapLibreLayer) =>
          layer.type === 'symbol' && layer.id.includes('label'),
        );
        labelLayers.forEach((layer: MapLibreLayer) => {
          map.setLayoutProperty(
            layer.id,
            'visibility',
            showLabels ? 'visible' : 'none',
          );
        });

        // Add terrain if requested (requires terrain source in style)
        if (showTerrain && !map.getTerrain()) {
          // Check if terrain source exists
          const terrainSource = Object.keys(map.getStyle().sources).find(
            source => source.includes('terrain'),
          );
          if (terrainSource) {
            map.setTerrain({ source: terrainSource, exaggeration: 1.5 });
          }
        } else if (!showTerrain && map.getTerrain()) {
          map.setTerrain(null);
        }

        // Note: Traffic and transit layers depend on the map style
        // and may not be available in all styles

        // Optional demo overlay: small squares around the map center with feature ids
        if (enableDemoOverlay) {
          try {
            const c = { lng: entity?.viewport?.center?.[0] ?? 0, lat: entity?.viewport?.center?.[1] ?? 0 } as { lng: number; lat: number };
            const dx = 0.05, dy = 0.03;
            const mkPoly = (cx:number, cy:number, w:number, h:number) => ([
              [cx-w, cy-h],[cx+w, cy-h],[cx+w, cy+h],[cx-w, cy+h],[cx-w, cy-h],
            ]);
            const demoData = {
              type: 'FeatureCollection',
              features: [
                { type: 'Feature', id: 'demo-1', properties: { name: 'Demo Area A', nodeType: 'basemap' }, geometry: { type: 'Polygon', coordinates: [ mkPoly(c.lng-0.08, c.lat, dx, dy) ] } },
                { type: 'Feature', id: 'demo-2', properties: { name: 'Demo Area B', nodeType: 'basemap' }, geometry: { type: 'Polygon', coordinates: [ mkPoly(c.lng+0.08, c.lat, dx, dy) ] } },
              ],
            } as any;
            if (!map.getSource('demo-source')) {
              map.addSource('demo-source', { type: 'geojson', data: demoData });
            }
            if (!map.getLayer('demo-fill')) {
              map.addLayer({
                id: 'demo-fill', type: 'fill', source: 'demo-source',
                paint: {
                  'fill-color': [
                    'case',
                    ['to-boolean', ['feature-state', 'selected']], '#1976d2',
                    ['to-boolean', ['feature-state', 'hovered']], '#64b5f6',
                    '#3f51b5'
                  ],
                  'fill-opacity': 0.25,
                },
              });
            }
            if (!map.getLayer('demo-outline')) {
              map.addLayer({
                id: 'demo-outline', type: 'line', source: 'demo-source',
                paint: {
                  'line-color': [
                    'case',
                    ['to-boolean', ['feature-state', 'selected']], '#0d47a1',
                    ['to-boolean', ['feature-state', 'hovered']], '#1976d2',
                    '#283593'
                  ],
                  'line-width': [
                    'case',
                    ['to-boolean', ['feature-state', 'selected']], 3,
                    ['to-boolean', ['feature-state', 'hovered']], 2.5,
                    2
                  ],
                },
              });
            }
            // Bind events if user didn’t set custom binding
            if (!bindSourceId || !bindLayerIds || bindLayerIds.length === 0) {
              try { unbindRef.current?.(); } catch {}
              unbindRef.current = bindMapLibre(map, 'demo-source', ['demo-fill','demo-outline'], { selectOnClick: true });
            }
          } catch {}
        }
      });
    }

    // Set attribution if provided
    if (entity?.displayOptions?.attribution) {
      map.getContainer().setAttribute(
        'data-attribution',
        entity.displayOptions.attribution,
      );
    }

    // Call parent callback
    onLoad?.(map);
  }, [entity, onLoad]);

  // Bind/unbind MapLibre hover/click events for cross-highlighting when requested
  useEffect(() => {
    if (!_mapInstance || !bindSourceId || !bindLayerIds || bindLayerIds.length === 0) return;
    try {
      unbindRef.current?.();
      unbindRef.current = bindMapLibre(_mapInstance, bindSourceId, bindLayerIds, { selectOnClick: true });
    } catch {}
    return () => { try { unbindRef.current?.(); } catch {} };
  }, [_mapInstance, bindSourceId, JSON.stringify(bindLayerIds), bindMapLibre]);

  // Handle view state changes
  const handleViewStateChange = useCallback((viewState: MapViewState) => {
    // Could update entity here if needed
    onViewStateChange?.(viewState);
  }, [onViewStateChange]);

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

  // Render map
  return (
    <Box sx={{ width, height, position: 'relative', ...style }}>
      <MapLibreMap
        initialViewState={initialViewState}
        mapStyle={mapStyleUrl}
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
      </MapLibreMap>

      {/* Attribution overlay if needed */}
      {entity.displayOptions?.attribution && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            px: 1,
            py: 0.5,
            fontSize: '10px',
            pointerEvents: 'none',
          }}
        >
          {entity.displayOptions.attribution}
        </Box>
      )}

      {/* Focus detail via Snackbar (shared channel for basemap) */}
      <CrossViewSnackbar datasetId={dsId} />
    </Box>
  );
};

export default BaseMapDisplay;
