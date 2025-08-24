/**
 * @file BaseMapView.tsx
 * @description BaseMap view component with actual MapLibre GL integration
 */

import React, { useState, useCallback } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { MapLibreMap, type MapViewState, type MapLibreMapInstance } from '@hierarchidb/ui-map';
import type { BaseMapEntity } from '../types';
import type { NodeId } from '@hierarchidb/common-core';

export interface BaseMapViewProps {
  nodeId: NodeId;
  entity?: BaseMapEntity;
  width?: string | number;
  height?: string | number;
  interactive?: boolean;
}

export const BaseMapView: React.FC<BaseMapViewProps> = ({
  entity,
  width = '100%',
  height = '400px',
  interactive = true,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Extract initial view state from entity
  const initialViewState: MapViewState = entity ? {
    longitude: entity.center[0],
    latitude: entity.center[1],
    zoom: entity.zoom,
    bearing: entity.bearing,
    pitch: entity.pitch,
  } : {
    longitude: 0,
    latitude: 0,
    zoom: 2,
  };

  // Determine map style
  const getMapStyle = (): string => {
    if (!entity) return 'https://demotiles.maplibre.org/style.json';
    
    if (entity.mapStyle === 'custom' && entity.styleUrl) {
      return entity.styleUrl;
    }
    
    // Use predefined style presets
    const styleUrls = {
      streets: 'https://demotiles.maplibre.org/style.json',
      satellite: 'https://api.maptiler.com/maps/satellite/style.json?key=demo',
      hybrid: 'https://api.maptiler.com/maps/hybrid/style.json?key=demo',
      terrain: 'https://api.maptiler.com/maps/terrain/style.json?key=demo',
      custom: 'https://demotiles.maplibre.org/style.json',
    };
    
    return styleUrls[entity.mapStyle] || styleUrls.streets;
  };

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    setLoading(false);
    setError(null);
    console.log('Map loaded successfully', map);
  }, []);

  const handleViewStateChange = useCallback((viewState: MapViewState) => {
    // In a real implementation, you might want to update the entity with new view state
    console.log('View state changed:', viewState);
  }, []);



  if (!entity) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100',
          border: '1px solid',
          borderColor: 'grey.300',
          borderRadius: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Loading map configuration...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width, height }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 1000,
          }}
        >
          <CircularProgress size={40} />
        </Box>
      )}

      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            zIndex: 1001,
          }}
        >
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      <MapLibreMap
        initialViewState={initialViewState}
        mapStyle={getMapStyle()}
        width={width}
        height={height}
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
      />

      {/* Map overlay information */}
      {entity && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            p: 1,
            borderRadius: 1,
            boxShadow: 1,
            fontSize: '0.75rem',
            zIndex: 999,
          }}
        >
          <Typography variant="caption" display="block">
            {entity.name || 'Untitled Map'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Style: {entity.mapStyle}
          </Typography>
          {entity.apiKey && (
            <Typography variant="caption" color="text.secondary" display="block">
              API Key: configured
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default BaseMapView;