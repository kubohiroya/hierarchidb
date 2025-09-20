/**
 * @file MapLibreMap.tsx
 * @description Shared MapLibre GL map component for HierarchiDB
 */

import React, { useCallback, useRef, useState } from 'react';
import { Map as ReactMapLibreMap, MapProvider } from '@vis.gl/react-maplibre';
import type { MapLibreMapInstance } from '../types/maplibre-public';
import {
  BaseMapProps,
  DEFAULT_MAP_CONFIG,
  type MapClickEvent,
  type MapFeatureIdentifyResult,
} from '../types/unified-map-props';
import { resolveIdentifyCandidates } from '../lib/feature-identification';
// Load MapLibre CSS only in browser contexts to avoid worker/SSR errors
if (typeof document !== 'undefined') {
  // dynamic import prevents Vite HMR client from injecting styles in workers
  void import('maplibre-gl/dist/maplibre-gl.css');
}

// Re-export types for backward compatibility
export type { MapViewState, MapInteractionOptions } from '../types/unified-map-props.js';

export interface MapLibreMapProps extends BaseMapProps {
  /** Children components (layers, markers, etc.) */
  children?: React.ReactNode;
  /** Optional built-in control toggles */
  controls?: {
    navigation?: boolean | { position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' };
    scale?: boolean | { position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' };
    fullscreen?: boolean | { position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' };
    geolocate?: boolean | {
      position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      options?: Record<string, unknown>;
    };
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
                                                          identifyFeatureOnClick,
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
        if (controls.fullscreen) {
          const pos = typeof controls.fullscreen === 'object' && controls.fullscreen.position ? controls.fullscreen.position : 'top-right';
          if (mlib.FullscreenControl) map.addControl(new mlib.FullscreenControl(), pos);
        }
        if (controls.geolocate) {
          const pos = typeof controls.geolocate === 'object' && controls.geolocate.position ? controls.geolocate.position : 'top-right';
          const opts = typeof controls.geolocate === 'object' && controls.geolocate.options ? controls.geolocate.options : { trackUserLocation: true };
          if (mlib.GeolocateControl) map.addControl(new mlib.GeolocateControl(opts), pos);
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

  const handleMapClick = useCallback(
    (event: any) => {
      const mapEvent = event as MapClickEvent;
      if (!identifyFeatureOnClick) {
        onClick?.(mapEvent);
        return;
      }

      const baseResult = resolveIdentifyCandidates(mapRef.current, mapEvent, identifyFeatureOnClick);
      const enrichedEvent: MapClickEvent = {
        ...mapEvent,
        identifiedFeatureIds: baseResult.featureIds,
        identifiedFeatures: baseResult.features,
      };

      const identifyResult: MapFeatureIdentifyResult = {
        ...baseResult,
        originalEvent: enrichedEvent,
      };

      identifyFeatureOnClick.onIdentify?.(identifyResult);
      onClick?.(enrichedEvent);
    },
    [identifyFeatureOnClick, onClick],
  );

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
          onClick={handleMapClick}
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
