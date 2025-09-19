/**
 * @file MapLibreMap.tsx
 * @description Shared MapLibre GL map component for HierarchiDB
 */

import React, { useCallback, useRef, useState } from 'react';
import { Map as ReactMapLibreMap, MapProvider } from '@vis.gl/react-maplibre';
import type { MapLibreGeoJSONFeature, MapLibreMapInstance } from '../types/maplibre-public';
import {
  BaseMapProps,
  DEFAULT_MAP_CONFIG,
  type MapClickEvent,
  type MapFeatureIdentifyResult,
  type MapFeatureIdentifier,
} from '../types/unified-map-props';
// Load MapLibre CSS only in browser contexts to avoid worker/SSR errors
if (typeof document !== 'undefined') {
  // dynamic import prevents Vite HMR client from injecting styles in workers
  void import('maplibre-gl/dist/maplibre-gl.css');
}

// Re-export types for backward compatibility
export type { MapViewState, MapInteractionOptions } from '../types/unified-map-props';

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

const DEFAULT_IDENTIFY_RADIUS = 5;
const FALLBACK_ID_PROPERTY_KEYS = ['id', 'ID', 'Id', 'feature_id', 'featureId', 'FEATURE_ID', 'OBJECTID', 'objectid'];

const defaultFeatureIdAccessor = (feature: MapLibreGeoJSONFeature | null | undefined): MapFeatureIdentifier | undefined => {
  if (!feature) return undefined;
  const { id, properties } = feature;

  if (typeof id === 'string' || typeof id === 'number') {
    return id as MapFeatureIdentifier;
  }

  const props = (properties as Record<string, unknown> | null | undefined) ?? undefined;
  if (!props) return undefined;

  for (const key of FALLBACK_ID_PROPERTY_KEYS) {
    const value = props[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return value as MapFeatureIdentifier;
    }
  }

  return undefined;
};

const filterFeaturesByLayer = (
  features: MapLibreGeoJSONFeature[] | undefined,
  layerIds?: string[],
): MapLibreGeoJSONFeature[] => {
  if (!Array.isArray(features) || features.length === 0) {
    return [];
  }

  if (!layerIds || layerIds.length === 0) {
    return features.filter((feature): feature is MapLibreGeoJSONFeature => Boolean(feature));
  }

  const allowed = new Set(layerIds);
  return features.filter((feature): feature is MapLibreGeoJSONFeature => {
    if (!feature) return false;
    const layerId = feature.layer?.id;
    if (!layerId) return false;
    return allowed.has(layerId);
  });
};

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

  const identifyFeaturesAtClick = useCallback(
    (event: MapClickEvent): MapFeatureIdentifyResult | null => {
      if (!identifyFeatureOnClick) {
        return null;
      }

      const { layerIds, radius, getFeatureId, onIdentify } = identifyFeatureOnClick;
      const searchRadius = typeof radius === 'number' && radius >= 0 ? radius : DEFAULT_IDENTIFY_RADIUS;

      const map = mapRef.current;
      let features: MapLibreGeoJSONFeature[] | undefined;

      if (map && typeof map.queryRenderedFeatures === 'function' && event.point) {
        try {
          const queryGeometry =
            searchRadius > 0
              ? (
                  [
                    [event.point.x - searchRadius, event.point.y - searchRadius],
                    [event.point.x + searchRadius, event.point.y + searchRadius],
                  ] as const
                )
              : event.point;

          const queryOptions = layerIds && layerIds.length > 0 ? { layers: layerIds } : undefined;
          const queried = map.queryRenderedFeatures(queryGeometry as any, queryOptions);
          if (Array.isArray(queried)) {
            features = queried as MapLibreGeoJSONFeature[];
          }
        } catch (error) {
          console.warn('MapLibreMap: queryRenderedFeatures failed, falling back to event features.', error);
        }
      }

      if ((!features || features.length === 0) && Array.isArray(event.features)) {
        features = event.features as MapLibreGeoJSONFeature[];
      }

      const filteredFeatures = filterFeaturesByLayer(features, layerIds);
      const idAccessor = getFeatureId ?? defaultFeatureIdAccessor;

      const seenIds = new Set<MapFeatureIdentifier>();
      const featureIds: MapFeatureIdentifier[] = [];

      for (const feature of filteredFeatures) {
        const candidate = idAccessor(feature);
        if (candidate === null || candidate === undefined) {
          continue;
        }
        if (!seenIds.has(candidate)) {
          seenIds.add(candidate);
          featureIds.push(candidate);
        }
      }

      const result: MapFeatureIdentifyResult = {
        featureIds,
        features: filteredFeatures,
        originalEvent: event,
      };

      onIdentify?.(result);

      return result;
    },
    [identifyFeatureOnClick],
  );

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
      const identifyResult = identifyFeaturesAtClick(mapEvent);

      if (onClick) {
        if (identifyResult) {
          onClick({
            ...mapEvent,
            identifiedFeatureIds: identifyResult.featureIds,
            identifiedFeatures: identifyResult.features,
          });
        } else {
          onClick(mapEvent);
        }
      }
    },
    [identifyFeaturesAtClick, onClick],
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
