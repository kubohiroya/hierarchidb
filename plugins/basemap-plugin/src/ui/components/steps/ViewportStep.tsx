import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  loadMapLibreMap,
  type MapLibreMapInstance,
  type MapLibreStyle,
  type MapViewState,
} from '@hierarchidb/ui-map';
import { Box, Stack, TextField, Typography } from '@mui/material';
import { atom, type PrimitiveAtom } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type React from 'react';
import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MapStyle, MapViewport } from '../../../common/types/BaseMapEntity.js';
import { resolveMapStyleSource } from '../../utils/mapStyle.js';

export interface ViewportStepProps {
  value: MapViewport | undefined;
  mapStyle?: MapStyle;
  onChange: (next: MapViewport) => void;
}

const FALLBACK_VIEWPORT: MapViewport = {
  center: [0, 0],
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

const OSM_RASTER_STYLE = {
  version: 8,
  name: 'osm-basemap',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

const areViewStatesEqual = (a: MapViewState, b: MapViewState) => {
  const eps = 1e-6;
  return (
    Math.abs(a.longitude - b.longitude) < eps &&
    Math.abs(a.latitude - b.latitude) < eps &&
    Math.abs(a.zoom - b.zoom) < eps &&
    Math.abs((a.bearing ?? 0) - (b.bearing ?? 0)) < eps
  );
};

const LazyMapLibreMap = lazy(async () => {
  const mod = await loadMapLibreMap();
  return { default: mod.MapLibreMap };
});

export const ViewportStep: React.FC<ViewportStepProps> = ({ value, mapStyle, onChange }) => {
  const { t } = useTranslation('basemap-plugin');
  const controlId = useId();
  type AtomStore = ReturnType<typeof createStore>;
  const initial = useMemo<MapViewState>(
    () => ({
      longitude: value?.center[0] ?? FALLBACK_VIEWPORT.center[0],
      latitude: value?.center[1] ?? FALLBACK_VIEWPORT.center[1],
      zoom: value?.zoom ?? FALLBACK_VIEWPORT.zoom,
      bearing: value?.bearing ?? FALLBACK_VIEWPORT.bearing,
      pitch: 0,
    }),
    [value]
  );

  const [viewState, setViewState] = useState<MapViewState>(initial);
  const [canRenderMap, setCanRenderMap] = useState(false);
  const lastEmittedRef = useRef<MapViewState>(initial);
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const dragStoreRef = useRef<AtomStore>(createStore());
  const dragAtomRef = useRef<PrimitiveAtom<MapViewState>>(atom(initial));

  const setDragViewState = useCallback((next: MapViewState) => {
    dragStoreRef.current.set(dragAtomRef.current, next);
  }, []);

  useEffect(() => {
    // Ensure we only render the map after the component is mounted in the browser.
    setCanRenderMap(true);
  }, []);

  // Sync local viewState when parent value changes
  useEffect(() => {
    const next: MapViewState = {
      longitude: value?.center[0] ?? FALLBACK_VIEWPORT.center[0],
      latitude: value?.center[1] ?? FALLBACK_VIEWPORT.center[1],
      zoom: value?.zoom ?? FALLBACK_VIEWPORT.zoom,
      bearing: value?.bearing ?? FALLBACK_VIEWPORT.bearing,
      pitch: 0,
    };
    setViewState((prev) => (areViewStatesEqual(prev, next) ? prev : next));
    setDragViewState(next);
    lastEmittedRef.current = next;
    if (mapRef.current) {
      const mapState: MapViewState = {
        longitude: mapRef.current.getCenter().lng,
        latitude: mapRef.current.getCenter().lat,
        zoom: mapRef.current.getZoom(),
        bearing: mapRef.current.getBearing(),
        pitch: mapRef.current.getPitch(),
      };
      if (!areViewStatesEqual(mapState, next)) {
        mapRef.current.jumpTo({
          center: [next.longitude, next.latitude],
          zoom: next.zoom,
          bearing: next.bearing ?? 0,
          pitch: 0,
        });
      }
    }
  }, [value]);

  const mapStyleSource = useMemo(() => {
    if (mapStyle) return resolveMapStyleSource(mapStyle);
    return OSM_RASTER_STYLE as unknown as MapLibreStyle;
  }, [mapStyle]);

  const mapStyleProps = useMemo(
    () =>
      typeof mapStyleSource === 'string'
        ? { mapStyleUrl: mapStyleSource }
        : { mapStyleObject: mapStyleSource },
    [mapStyleSource]
  );

  const mapInteractionOptions = useMemo(
    () => ({
      interactive: true,
      scrollZoom: true,
      dragPan: true,
      dragRotate: false,
      doubleClickZoom: true,
      touchZoomRotate: true,
    }),
    []
  );

  const navigationControls = useMemo(
    () => ({ navigation: { position: 'top-right' as const } }),
    []
  );

  const commitViewState = useCallback(
    (next: MapViewState, source: 'form' | 'map-end') => {
      setViewState((prev) => {
        if (areViewStatesEqual(prev, next)) return prev;
        return next;
      });
      if (areViewStatesEqual(lastEmittedRef.current, next)) return;
      lastEmittedRef.current = next;
      if (source === 'form' && mapRef.current) {
        mapRef.current.jumpTo({
          center: [next.longitude, next.latitude],
          zoom: next.zoom,
          bearing: next.bearing ?? 0,
          pitch: 0,
        });
      }
      onChange({
        center: [next.longitude, next.latitude],
        zoom: next.zoom,
        bearing: next.bearing ?? 0,
        pitch: 0,
      });
    },
    [onChange]
  );

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    mapRef.current = map;
  }, []);

  const handleViewStateChange = useCallback(
    (next: MapViewState) => {
      setDragViewState(next);
      setViewState((prev) => (areViewStatesEqual(prev, next) ? prev : next));
    },
    [setDragViewState]
  );

  const handleViewStateChangeEnd = useCallback(
    (next: MapViewState) => {
      setDragViewState(next);
      const latest = dragStoreRef.current.get(dragAtomRef.current);
      commitViewState(latest ?? next, 'map-end');
    },
    [commitViewState, setDragViewState]
  );

  const setViewportFromInput = useCallback(
    (next: Partial<MapViewport>) => {
      const updated: MapViewState = {
        longitude: next.center?.[0] ?? viewState.longitude,
        latitude: next.center?.[1] ?? viewState.latitude,
        zoom: next.zoom ?? viewState.zoom,
        bearing: next.bearing ?? viewState.bearing ?? 0,
        pitch: 0,
      };
      commitViewState(updated, 'form');
    },
    [commitViewState, viewState]
  );

  const formatCoord = (val: number, digits: number = 4) => {
    if (!Number.isFinite(val)) return '0.0000';
    return val.toFixed(digits);
  };

  return (
    <Box
      sx={{
        p: 2,
        overscrollBehavior: 'contain',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflow: 'hidden',
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {t(
          'viewport.description',
          'Fine-tune the initial viewport. Enter values directly or use the map preview below.'
        )}
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ flexShrink: 0 }}>
        <TextField
          label={t('viewport.fields.longitude.label', 'Longitude')}
          type="number"
          id={`${controlId}-longitude`}
          name="longitude"
          inputProps={{
            step: 0.01,
            min: -180,
            max: 180,
            id: `${controlId}-longitude`,
            name: 'longitude',
          }}
          value={viewState.longitude}
          onChange={(e) =>
            setViewportFromInput({
              center: [Number(e.target.value), viewState.latitude],
            })
          }
          fullWidth
        />
        <TextField
          label={t('viewport.fields.latitude.label', 'Latitude')}
          type="number"
          id={`${controlId}-latitude`}
          name="latitude"
          inputProps={{
            step: 0.01,
            min: -90,
            max: 90,
            id: `${controlId}-latitude`,
            name: 'latitude',
          }}
          value={viewState.latitude}
          onChange={(e) =>
            setViewportFromInput({
              center: [viewState.longitude, Number(e.target.value)],
            })
          }
          fullWidth
        />
        <TextField
          label={t('viewport.fields.zoom.label', 'Zoom')}
          type="number"
          id={`${controlId}-zoom`}
          name="zoom"
          inputProps={{ step: 1, min: 0, max: 24, id: `${controlId}-zoom`, name: 'zoom' }}
          value={viewState.zoom}
          onChange={(e) => setViewportFromInput({ zoom: Number(e.target.value) })}
          fullWidth
        />
        <TextField
          label={t('viewport.fields.bearing.label', 'Bearing')}
          type="number"
          id={`${controlId}-bearing`}
          name="bearing"
          inputProps={{ step: 1, min: -180, max: 180, id: `${controlId}-bearing`, name: 'bearing' }}
          value={viewState.bearing ?? 0}
          onChange={(e) => setViewportFromInput({ bearing: Number(e.target.value) })}
          fullWidth
        />
      </Stack>

      <Box
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          position: 'relative',
          overscrollBehavior: 'contain',
          touchAction: 'none',
          flexGrow: 1,
          minHeight: 280,
        }}
      >
        {canRenderMap ? (
          <Suspense
            fallback={
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.secondary',
                  fontSize: 12,
                }}
              >
                {t('viewport.loading', 'Loading map…')}
              </Box>
            }
          >
            <LazyMapLibreMap
              initialViewState={initial}
              {...mapStyleProps}
              width="100%"
              height="100%"
              mapOptions={mapInteractionOptions}
              controls={navigationControls}
              onLoad={handleMapLoad}
              onViewStateChange={handleViewStateChange}
              onMoveEnd={handleViewStateChangeEnd}
            />
          </Suspense>
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
              fontSize: 12,
            }}
          >
            {t('viewport.preparing', 'Preparing map…')}
          </Box>
        )}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 32,
              height: 2,
              backgroundColor: 'rgba(255,255,255,0.95)',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 2px rgba(0,0,0,0.6)',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 2,
              height: 32,
              backgroundColor: 'rgba(255,255,255,0.95)',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 2px rgba(0,0,0,0.6)',
            },
          }}
        />
      </Box>

      <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="caption">
          {t(
            'viewport.summary',
            'Center: {{lng}}, {{lat}} / Zoom: {{zoom}} / Bearing: {{bearing}}',
            {
              lng: formatCoord(viewState.longitude),
              lat: formatCoord(viewState.latitude),
              zoom: viewState.zoom,
              bearing: viewState.bearing ?? 0,
            }
          )}
        </Typography>
      </Box>
    </Box>
  );
};
