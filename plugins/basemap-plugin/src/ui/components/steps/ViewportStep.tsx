import { Box, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadMapLibreMap, type MapViewState } from '@hierarchidb/ui-map';
import type { MapViewport } from '../../../common/types/BaseMapEntity.js';

export interface ViewportStepProps {
  value: MapViewport | undefined;
  mapStyle?: unknown;
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
} as const;

let mapLibreComponentPromise: Promise<{ default: React.ComponentType<any> }> | null = null;
const LazyMapLibreMap = lazy(async () => {
  if (!mapLibreComponentPromise) {
    mapLibreComponentPromise = loadMapLibreMap().then((mod) => ({ default: mod.MapLibreMap }));
  }
  return mapLibreComponentPromise;
});

const areViewStatesEqual = (a: MapViewState, b: MapViewState) => {
  const eps = 1e-6;
  return (
    Math.abs(a.longitude - b.longitude) < eps &&
    Math.abs(a.latitude - b.latitude) < eps &&
    Math.abs(a.zoom - b.zoom) < eps &&
    Math.abs((a.bearing ?? 0) - (b.bearing ?? 0)) < eps
  );
};

export const ViewportStep: React.FC<ViewportStepProps> = ({ value, onChange }) => {
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
  }, [value]);

  const mapStyleSource = useMemo(
    () => OSM_RASTER_STYLE as unknown as Record<string, unknown>,
    []
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

  const navigationControls = useMemo(() => ({ navigation: { position: 'top-right' } }), []);

  const propagate = useCallback(
    (next: MapViewState, source: 'form' | 'map-move' | 'map-end') => {
      console.log('[Viewport] propagate', { source, next });
      setViewState((prev) => {
        if (areViewStatesEqual(prev, next)) return prev;
        return next;
      });
      onChange({
        center: [next.longitude, next.latitude],
        zoom: next.zoom,
        bearing: next.bearing ?? 0,
        pitch: 0,
      });
    },
    [onChange]
  );

  const handleViewStateChange = useCallback(
    (next: MapViewState) => {
      console.log('[Viewport] onMove', next);
      propagate(next, 'map-move');
    },
    [propagate]
  );

  const handleViewStateChangeEnd = useCallback(
    (next: MapViewState) => {
      console.log('[Viewport] onMoveEnd', next);
      propagate(next, 'map-end');
    },
    [propagate]
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
      console.log('[Viewport] form input', updated);
      propagate(updated, 'form');
    },
    [propagate, viewState]
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
        Fine-tune the initial viewport. Enter values directly or use the map preview below.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ flexShrink: 0 }}>
        <TextField
          label="Longitude"
          type="number"
          inputProps={{ step: 0.01, min: -180, max: 180 }}
          value={viewState.longitude}
          onChange={(e) =>
            setViewportFromInput({
              center: [Number(e.target.value), viewState.latitude],
            })
          }
          fullWidth
        />
        <TextField
          label="Latitude"
          type="number"
          inputProps={{ step: 0.01, min: -90, max: 90 }}
          value={viewState.latitude}
          onChange={(e) =>
            setViewportFromInput({
              center: [viewState.longitude, Number(e.target.value)],
            })
          }
          fullWidth
        />
        <TextField
          label="Zoom"
          type="number"
          inputProps={{ step: 1, min: 0, max: 24 }}
          value={viewState.zoom}
          onChange={(e) => setViewportFromInput({ zoom: Number(e.target.value) })}
          fullWidth
        />
        <TextField
          label="Bearing"
          type="number"
          inputProps={{ step: 1, min: -180, max: 180 }}
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
        <Suspense
          fallback={
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Loading map…
              </Typography>
            </Box>
          }
        >
          <LazyMapLibreMap
            initialViewState={initial}
            viewState={viewState}
            mapStyle={mapStyleSource}
            width="100%"
            height="100%"
            mapOptions={mapInteractionOptions}
            controls={navigationControls}
            onLoad={() => {
              // no-op
            }}
            onViewStateChange={handleViewStateChange}
            onMoveEnd={handleViewStateChangeEnd}
          />
        </Suspense>
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
          Center: {formatCoord(viewState.longitude)}, {formatCoord(viewState.latitude)} / Zoom:{' '}
          {viewState.zoom} / Bearing: {viewState.bearing ?? 0}
        </Typography>
      </Box>
    </Box>
  );
};
