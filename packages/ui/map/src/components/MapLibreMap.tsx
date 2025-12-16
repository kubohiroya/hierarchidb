/**
 * @file MapLibreMap.tsx
 * @description Shared MapLibre GL map component for HierarchiDB
 */

import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Map as ReactMapLibreMap, MapProvider } from '@vis.gl/react-maplibre';
import { Snackbar } from '@mui/material';
import type { MapLibreMapInstance } from '../types/maplibre-public.js';
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
                                                        }) => {
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [identifySnackbarState, setIdentifySnackbarState] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const defaultIdentifyConfig = useMemo<MapFeatureIdentifyConfig>(() => ({
    radius: DEFAULT_IDENTIFY_RADIUS,
  }), []);

  const handleMapLoad = useCallback((e: any) => {
    const map = e.target;
    mapRef.current = map;
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
      });
    }
    setMapLoaded(true);
    onLoad?.(map);
  }, [onLoad, controls]);

  const handleMove = useCallback(
    (event: any) => {
      const { longitude, latitude, zoom, bearing, pitch } = event.viewState as MapViewState;
      const nextState: MapViewState = { longitude, latitude, zoom, bearing, pitch };
      onMove?.(nextState);
      onViewStateChange?.(nextState);
    },
    [onMove, onViewStateChange]
  );

  const handleMoveEnd = useCallback(
    (event: any) => {
      const { longitude, latitude, zoom, bearing, pitch } = event.viewState as MapViewState;
      const nextState: MapViewState = { longitude, latitude, zoom, bearing, pitch };
      onMoveEnd?.(nextState);
    },
    [onMoveEnd]
  );

  const handleMapClick = useCallback(
    (event: any) => {
      const mapEvent = event as MapClickEvent;
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

      const disableDefaultSnackbar = identifyFeatureOnClick?.disableDefaultSnackbar ?? false;
      if (!disableDefaultSnackbar) {
        const idsText = identifyResult.featureIds.length > 0 ? identifyResult.featureIds.map((id) => String(id)).join(', ') : 'No features';
        const lng = enrichedEvent.lngLat?.lng;
        const lat = enrichedEvent.lngLat?.lat;
        const locationText = lng !== undefined && lat !== undefined ? `@ (${lng.toFixed(4)}, ${lat.toFixed(4)})` : '';
        setIdentifySnackbarState({
          open: true,
          message: `${idsText} ${locationText}`.trim(),
        });
      }

      effectiveIdentifyConfig.onIdentify?.(identifyResult);
      onClick?.(enrichedEvent);
    },
    [defaultIdentifyConfig, identifyFeatureOnClick, onClick],
  );
  const handleSnackbarClose = useCallback((_: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setIdentifySnackbarState((prev) => ({ ...prev, open: false }));
  }, []);




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

  const resolvedMapStyle = (mapStyleObject ?? mapStyleUrl ?? defaultMapStyleUrl) as React.ComponentProps<typeof ReactMapLibreMap>['mapStyle'];

  return (
    <div style={containerStyle as any}>
      <MapProvider>
        <ReactMapLibreMap
          style={mapStyleForMapLibre}
          mapStyle={resolvedMapStyle}
          initialViewState={initialViewState}
          viewState={viewState}
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
        >
          {mapLoaded && children}
        </ReactMapLibreMap>
      </MapProvider>
      <Snackbar
        open={identifySnackbarState.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        message={identifySnackbarState.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </div>
  );
};
