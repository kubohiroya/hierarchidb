/**
 * @file MapLibreMap.tsx
 * @description Shared MapLibre GL map component for HierarchiDB
 */

import React, { useRef, useState, useCallback } from 'react';
import { Map as ReactMapLibreMap, MapProvider } from '@vis.gl/react-maplibre';
import type { Map as MapLibreMapInstance } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface MapLibreMapProps {
  /** Initial view state */
  initialViewState: MapViewState;
  
  /** Map style URL or style object */
  mapStyle?: string;
  
  /** Map container width */
  width?: string | number;
  
  /** Map container height */
  height?: string | number;
  
  /** Additional CSS styles for the container */
  style?: React.CSSProperties;
  
  /** Callback when map loads */
  onLoad?: (map: MapLibreMapInstance) => void;
  
  /** Callback when view state changes */
  onViewStateChange?: (viewState: MapViewState) => void;
  
  /** Callback when map is clicked */
  onClick?: (event: any) => void;
  
  /** Children components (layers, markers, etc.) */
  children?: React.ReactNode;
  
  /** Additional map options */
  mapOptions?: {
    interactive?: boolean;
    scrollZoom?: boolean;
    dragPan?: boolean;
    dragRotate?: boolean;
    doubleClickZoom?: boolean;
    touchZoomRotate?: boolean;
  };
}

const defaultMapStyle = 'https://demotiles.maplibre.org/style.json';

const defaultMapOptions = {
  interactive: true,
  scrollZoom: true,
  dragPan: true,
  dragRotate: true,
  doubleClickZoom: true,
  touchZoomRotate: true,
};

export const MapLibreMap: React.FC<MapLibreMapProps> = ({
  initialViewState,
  mapStyle = defaultMapStyle,
  width = '100%',
  height = '400px',
  style,
  onLoad,
  onViewStateChange,
  onClick,
  children,
  mapOptions = defaultMapOptions,
}) => {
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleMapLoad = useCallback((e: any) => {
    const map = e.target;
    mapRef.current = map;
    setMapLoaded(true);
    onLoad?.(map);
  }, [onLoad]);

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
          mapStyle={mapStyle}
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