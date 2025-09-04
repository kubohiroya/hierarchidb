/**
 * @file MapLibreMap.tsx
 * @description Shared MapLibre GL map component for HierarchiDB
 */

import React, { useRef, useState, useCallback } from 'react';
import { Map as ReactMapLibreMap, MapProvider } from '@vis.gl/react-maplibre';
import type { MapLibreMapInstance } from '../types/maplibre-public';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BaseMapProps, DEFAULT_MAP_CONFIG } from '../types/unified-map-props';

// Re-export types for backward compatibility
export type { MapViewState, MapInteractionOptions } from '../types/unified-map-props';

export interface MapLibreMapProps extends BaseMapProps {
  /** Children components (layers, markers, etc.) */
  children?: React.ReactNode;
  /** Optional built-in control toggles */
  controls?: {
    navigation?: boolean | { position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' };
    scale?: boolean | { position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' };
  };
}

// Default values from unified config
const { mapStyle: defaultMapStyle, interactionOptions: defaultMapOptions } = DEFAULT_MAP_CONFIG;

export const MapLibreMap: React.FC<MapLibreMapProps> = ({
  initialViewState,
  mapStyle = defaultMapStyle,
  width = DEFAULT_MAP_CONFIG.dimensions.width,
  height = DEFAULT_MAP_CONFIG.dimensions.height,
  style,
  onLoad,
  onViewStateChange,
  onClick,
  children,
  mapOptions = defaultMapOptions,
  controls,
}) => {
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleMapLoad = useCallback((e: any) => {
    const map = e.target;
    mapRef.current = map;
    // Optional built-in controls
    if (controls) {
      try {
        const mlib = require('maplibre-gl');
        if (controls.navigation) {
          const pos = typeof controls.navigation === 'object' && controls.navigation.position ? controls.navigation.position : 'top-right';
          map.addControl(new mlib.NavigationControl(), pos);
        }
        if (controls.scale) {
          const pos = typeof controls.scale === 'object' && controls.scale.position ? controls.scale.position : 'bottom-left';
          map.addControl(new mlib.ScaleControl(), pos);
        }
      } catch {
        // ignore if maplibre-gl is not resolvable in this environment
      }
    }
    setMapLoaded(true);
    onLoad?.(map);
  }, [onLoad, controls]);

  const handleViewStateChange = useCallback((event: any) => {
    if (onViewStateChange) {
      const { longitude, latitude, zoom, bearing, pitch } = event.viewState;
      onViewStateChange({
        longitude,
        latitude,
        zoom,
        bearing,
        pitch,
      });
    }
  }, [onViewStateChange]);

  const containerStyle: React.CSSProperties = {
    width,
    height,
    position: 'relative',
    ...style,
  };

  const mapStyleForMapLibre = {
    width: '100%',
    height: '100%',
  };

  return (
    <div style={containerStyle}>
      <MapProvider>
        <ReactMapLibreMap
          style={mapStyleForMapLibre}
          mapStyle={mapStyle as any}
          initialViewState={initialViewState}
          onLoad={handleMapLoad}
          onMove={handleViewStateChange}
          onClick={onClick}
          interactive={mapOptions.interactive}
          scrollZoom={mapOptions.scrollZoom}
          dragPan={mapOptions.dragPan}
          dragRotate={mapOptions.dragRotate}
          doubleClickZoom={mapOptions.doubleClickZoom}
          touchZoomRotate={mapOptions.touchZoomRotate}
        >
          {mapLoaded && children}
        </ReactMapLibreMap>
      </MapProvider>
    </div>
  );
};

export default MapLibreMap;
