/**
 * @file BaseMapDisplay.tsx
 * @description BaseMap display component using MapLibre GL
 * Renders the configured basemap with all settings applied
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { MapLibreMap, type MapViewState, type MapLibreMapInstance } from '@hierarchidb/ui-map';
import type { NodeId } from '@hierarchidb/common-core';
import type { BaseMapEntity } from '../types/BaseMapEntity';
import { BaseMapEntityHandler } from '../handlers/BaseMapEntityHandler';
import { BUILT_IN_STYLES } from '../constants/builtInStyles';

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
  interactive = true
}) => {
  const [entity, setEntity] = useState<BaseMapEntity | undefined>(providedEntity);
  const [loading, setLoading] = useState(!providedEntity);
  const [error, setError] = useState<string | null>(null);
  const [_mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);

  // Fetch entity if not provided
  useEffect(() => {
    if (!providedEntity && nodeId) {
      const handler = new BaseMapEntityHandler();
      setLoading(true);
      handler.getEntity(nodeId)
        .then(data => {
          if (data) {
            setEntity(data);
            setError(null);
          } else {
            setError('BaseMap entity not found');
          }
        })
        .catch(err => {
          console.error('Failed to load BaseMap entity:', err);
          setError('Failed to load map configuration');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [nodeId, providedEntity]);

  // Convert entity viewport to MapLibre view state
  // Priority: zxy prop > viewport configuration
  const initialViewState = useMemo<MapViewState | undefined>(() => {
    // If zxy is provided, use it for initial position
    if (entity?.zxy && entity.zxy.length === 3) {
      const [zoom, longitude, latitude] = entity.zxy;
      return {
        longitude,
        latitude,
        zoom,
        bearing: entity.viewport?.bearing || 0,
        pitch: entity.viewport?.pitch || 0
      };
    }
    
    // Otherwise, use viewport configuration
    if (!entity?.viewport) return undefined;
    
    return {
      longitude: entity.viewport.center[0],
      latitude: entity.viewport.center[1],
      zoom: entity.viewport.zoom,
      bearing: entity.viewport.bearing || 0,
      pitch: entity.viewport.pitch || 0
    };
  }, [entity]);

  // Get map style URL based on configuration
  const mapStyleUrl = useMemo(() => {
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
      return customStyleConfig as any; // MapLibre accepts both URL and style object
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
        showLabels 
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
        const labelLayers = map.getStyle().layers.filter(layer => 
          layer.type === 'symbol' && layer.id.includes('label')
        );
        labelLayers.forEach(layer => {
          map.setLayoutProperty(
            layer.id, 
            'visibility', 
            showLabels ? 'visible' : 'none'
          );
        });

        // Add terrain if requested (requires terrain source in style)
        if (showTerrain && !map.getTerrain()) {
          // Check if terrain source exists
          const terrainSource = Object.keys(map.getStyle().sources).find(
            source => source.includes('terrain')
          );
          if (terrainSource) {
            map.setTerrain({ source: terrainSource, exaggeration: 1.5 });
          }
        } else if (!showTerrain && map.getTerrain()) {
          map.setTerrain(null);
        }

        // Note: Traffic and transit layers depend on the map style
        // and may not be available in all styles
      });
    }

    // Set attribution if provided
    if (entity?.displayOptions?.attribution) {
      map.getContainer().setAttribute(
        'data-attribution',
        entity.displayOptions.attribution
      );
    }

    // Call parent callback
    onLoad?.(map);
  }, [entity, onLoad]);

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
          ...style
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
          touchZoomRotate: interactive
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
            pointerEvents: 'none'
          }}
        >
          {entity.displayOptions.attribution}
        </Box>
      )}
    </Box>
  );
};

export default BaseMapDisplay;