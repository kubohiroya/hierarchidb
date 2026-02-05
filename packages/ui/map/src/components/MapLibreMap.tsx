/**
 * @file MapLibreMap.tsx
 * @description Shared MapLibre GL map component for HierarchiDB
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map as ReactMapLibreMap, MapProvider } from '@vis.gl/react-maplibre';
import type { MapLibreMapInstance } from '../types/maplibre-public.js';
import type { MapAttributionControlOptions } from '../types/attribution.js';
import {
  type BaseMapProps,
  DEFAULT_MAP_CONFIG,
  type MapClickEvent,
  type MapFeatureIdentifyResult,
  type MapFeatureIdentifyConfig,
  type MapViewState,
} from '../types/unified-map-props.js';
import { DEFAULT_IDENTIFY_RADIUS, resolveIdentifyCandidates } from '../lib/feature-identification.js';
import { loadMapLibreModule } from '../utils/maplibre-loader.js';
import { formatAttributionItems } from '../utils/attribution.js';
// Load MapLibre CSS only in browser contexts to avoid worker/SSR errors
if (typeof document !== 'undefined') {
  // dynamic import prevents Vite HMR client from injecting styles in workers
  void import('maplibre-gl/dist/maplibre-gl.css');
}

// Re-export types for backward compatibility
export type { MapViewState, MapInteractionOptions } from '../types/unified-map-props.js';

export type MapLibreMapProps = BaseMapProps & {
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
    attribution?: boolean | MapAttributionControlOptions;
  };
};

// Default values from unified config
const { mapStyleUrl: defaultMapStyleUrl, interactionOptions: defaultMapOptions } = DEFAULT_MAP_CONFIG;

type SafeStyle = Omit<React.CSSProperties, 'background'> & { background?: string };

const normalizeStyle = (style?: React.CSSProperties): SafeStyle | undefined => {
  if (!style) return undefined;
  const { background, ...rest } = style;
  const safeBackground = typeof background === 'string' ? background : undefined;
  return (safeBackground !== undefined ? { ...rest, background: safeBackground } : { ...rest }) as SafeStyle;
};

const parseQueryBoolean = (value: string | null): boolean | undefined => {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return undefined;
};

export const MapLibreMap: React.FC<MapLibreMapProps> = ({
                                                          initialViewState,
                                                          viewState,
                                                          mapStyleUrl = defaultMapStyleUrl,
                                                          mapStyleObject,
                                                          width = DEFAULT_MAP_CONFIG.dimensions.width,
                                                          height = DEFAULT_MAP_CONFIG.dimensions.height,
                                                          style,
                                                          onLoad,
                                                          onMove,
                                                          onMoveEnd,
                                                          onViewStateChange,
                                                          onClick,
                                                          children,
                                                          mapOptions = defaultMapOptions,
                                                          controls,
                                                          identifyFeatureOnClick,
                                                          showTileBoundaries,
                                                          showTileCoordinates,
                                                        }) => {
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const loggedPaintArraysRef = useRef(new Set<string>());
  const [mapLoaded, setMapLoaded] = useState(false);

  const defaultIdentifyConfig = useMemo<MapFeatureIdentifyConfig>(() => ({
    radius: DEFAULT_IDENTIFY_RADIUS,
  }), []);
  const locationSearch = typeof window !== 'undefined' ? window.location.search : '';
  const queryOverrides = useMemo(() => {
    if (!locationSearch) {
      return { showTileBoundaries: undefined, showTileCoordinates: undefined };
    }
    const params = new URLSearchParams(locationSearch);
    return {
      showTileBoundaries: parseQueryBoolean(params.get('showTileBoundaries')),
      showTileCoordinates: parseQueryBoolean(params.get('showTileCoordinates')),
    };
  }, [locationSearch]);

  const normalizePaintArrays = useCallback((map: MapLibreMapInstance) => {
    const style = map.getStyle?.();
    if (!style || !style.layers) return;
    style.layers.forEach((layer) => {
      const paint = layer.paint;
      if (!paint) return;
      Object.entries(paint).forEach(([key, value]) => {
        if (!Array.isArray(value) || value.length === 0) return;
        const first = value[0];
        const isExpressionArray = typeof first === 'string';
        const logKey = `${layer.id}:${key}`;
        if (!loggedPaintArraysRef.current.has(logKey)) {
          loggedPaintArraysRef.current.add(logKey);
          if (import.meta.env.DEV && !isExpressionArray) {
            // Debug which layer/paint has non-expression array values during style load.
            console.warn('[ui-map][paint-array]', {
              layerId: layer.id,
              property: key,
              isExpressionArray,
              value,
            });
          }
        }
        if (isExpressionArray) {
          map.setPaintProperty(layer.id, key, value);
          return;
        }
        map.setPaintProperty(layer.id, key, ['literal', value]);
      });
    });
  }, []);

  const resolvedShowTileBoundaries =
    queryOverrides.showTileBoundaries ?? showTileBoundaries ?? import.meta.env.DEV;
  const resolvedShowTileCoordinates =
    queryOverrides.showTileCoordinates ?? showTileCoordinates ?? import.meta.env.DEV;
  const applyDebugTileSettings = useCallback((map: MapLibreMapInstance | null) => {
    if (!map) return;
    map.showTileBoundaries = resolvedShowTileBoundaries;
    map.showTileCoordinates = resolvedShowTileCoordinates;
    map.triggerRepaint?.();
  }, [resolvedShowTileBoundaries, resolvedShowTileCoordinates]);

  const handleMapLoad = useCallback((e: {target: MapLibreMapInstance}) => {
    const map = e.target;
    mapRef.current = map;
    normalizePaintArrays(map);
    map.on('styledata', () => normalizePaintArrays(map));
    applyDebugTileSettings(map);
    if (controls) {
      void loadMapLibreModule().then((mlib) => {
        if (!mlib) return;
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
        const attributionControl = controls.attribution;
        if (attributionControl) {
          const options = typeof attributionControl === 'object' ? attributionControl : {};
          const pos = options.position ?? 'bottom-right';
          const customAttribution = options.items && options.items.length > 0
            ? formatAttributionItems(options.items)
            : undefined;
          map.addControl(new mlib.AttributionControl({ compact: options.compact ?? true, customAttribution }), pos);
        }
      });
    }
    setMapLoaded(true);
    onLoad?.(map);
  }, [onLoad, controls, normalizePaintArrays, applyDebugTileSettings]);

  const resolveZoomBounds = useCallback(() => {
    const fallbackMin = DEFAULT_MAP_CONFIG.interactionOptions.minZoom ?? 0;
    const fallbackMax = DEFAULT_MAP_CONFIG.interactionOptions.maxZoom ?? 22;
    const minZoom = typeof mapOptions.minZoom === 'number' ? mapOptions.minZoom : fallbackMin;
    const maxZoom = typeof mapOptions.maxZoom === 'number' ? mapOptions.maxZoom : fallbackMax;
    return { minZoom, maxZoom };
  }, [mapOptions.maxZoom, mapOptions.minZoom]);

  const clampViewStateZoom = useCallback((state: MapViewState): MapViewState => {
    const { minZoom, maxZoom } = resolveZoomBounds();
    const clampedZoom = Math.min(maxZoom, Math.max(minZoom, state.zoom));
    if (clampedZoom === state.zoom) return state;
    return { ...state, zoom: clampedZoom };
  }, [resolveZoomBounds]);

  const handleMoveEnd = useCallback(
    (event: { viewState: MapViewState}) => {
      const { longitude, latitude, zoom, bearing, pitch } = event.viewState;
      const nextState: MapViewState = { longitude, latitude, zoom, bearing, pitch };
      const clampedState = clampViewStateZoom(nextState);
      onMoveEnd?.(clampedState);
    },
    [clampViewStateZoom, onMoveEnd]
  );

  const handleMapClick = useCallback(
    (event: MapClickEvent) => {
      const mapEvent = event;
      const effectiveIdentifyConfig: MapFeatureIdentifyConfig = identifyFeatureOnClick ?? defaultIdentifyConfig;

      const baseResult = resolveIdentifyCandidates(mapRef.current, mapEvent, effectiveIdentifyConfig);
      const enrichedEvent: MapClickEvent = {
        ...mapEvent,
        identifiedFeatureIds: baseResult.featureIds,
        identifiedFeatures: baseResult.features,
      };

      const identifyResult: MapFeatureIdentifyResult = {
        ...baseResult,
        originalEvent: enrichedEvent,
      };

      effectiveIdentifyConfig.onIdentify?.(identifyResult);
      onClick?.(enrichedEvent);
    },
    [defaultIdentifyConfig, identifyFeatureOnClick, onClick],
  );

  useEffect(() => {
    applyDebugTileSettings(mapRef.current);
  }, [applyDebugTileSettings]);

  const containerStyle: SafeStyle = {
    width,
    height,
    position: 'relative',
    ...normalizeStyle(style),
  };

  const mapStyleForMapLibre = {
    width: '100%',
    height: '100%',
  };

  const handleMove = useCallback(
    (event: { viewState: MapViewState}) => {
      const { longitude, latitude, zoom, bearing, pitch } = event.viewState;
      const nextState: MapViewState = { longitude, latitude, zoom, bearing, pitch };
      const clampedState = clampViewStateZoom(nextState);
      onMove?.(clampedState);
      onViewStateChange?.(clampedState);
    },
    [clampViewStateZoom, onMove, onViewStateChange]
  );

  const resolvedMapStyle = (mapStyleObject ?? mapStyleUrl ?? defaultMapStyleUrl) as React.ComponentProps<typeof ReactMapLibreMap>['mapStyle'];
  const clampedInitialViewState = useMemo(() => {
    if (!initialViewState) return initialViewState;
    return clampViewStateZoom(initialViewState);
  }, [clampViewStateZoom, initialViewState]);
  const clampedViewState = useMemo(() => {
    if (!viewState) return viewState;
    return clampViewStateZoom(viewState);
  }, [clampViewStateZoom, viewState]);
  const disableDefaultAttribution = Boolean(controls?.attribution);
  const resolvedZoomBounds = useMemo(() => resolveZoomBounds(), [resolveZoomBounds]);

  return (
    <div style={containerStyle}>
      <MapProvider>
        <ReactMapLibreMap
          style={mapStyleForMapLibre}
          mapStyle={resolvedMapStyle}
          initialViewState={clampedInitialViewState}
          viewState={clampedViewState}
          attributionControl={!disableDefaultAttribution}
          onLoad={handleMapLoad}
          onMove={handleMove}
          onMoveEnd={handleMoveEnd}
          onClick={handleMapClick}
          interactive={mapOptions.interactive}
          scrollZoom={mapOptions.scrollZoom}
          dragPan={mapOptions.dragPan}
          dragRotate={mapOptions.dragRotate}
          doubleClickZoom={mapOptions.doubleClickZoom}
          touchZoomRotate={mapOptions.touchZoomRotate}
          minZoom={resolvedZoomBounds.minZoom}
          maxZoom={resolvedZoomBounds.maxZoom}
          showTileBoundaries={resolvedShowTileBoundaries}
          showTileCoordinates={resolvedShowTileCoordinates}
        >
          {mapLoaded && children}
        </ReactMapLibreMap>
      </MapProvider>
    </div>
  );
};
