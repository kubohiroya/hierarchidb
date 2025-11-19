import type { NodeId } from '@hierarchidb/common-types';
import { Box, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadMapLibreMap, type MapLibreMapInstance, type MapViewState } from '@hierarchidb/ui-map';
import type { MapStyle, MapViewport } from '../../../common/types/BaseMapEntity.js';
import { useBaseMapEntity } from '../../hooks/useBaseMapEntity.js';
import { resolveMapStyleSource } from '../../utils/mapStyle.js';

export interface ViewportStepProps {
  value: MapViewport | undefined;
  mapStyle?: MapStyle;
  onChange: (next: MapViewport) => void;
  mode: 'create' | 'edit';
  nodeId?: string;
}

const LOCAL_STORAGE_KEY = 'zxy';
const DEFAULT_GEO_VIEWPORT: MapViewport = {
  center: [139.767, 35.681],
  zoom: 10,
  bearing: 0,
  pitch: 0,
};
const FALLBACK_VIEWPORT: MapViewport = {
  center: [0, 0],
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

const DEFAULT_STYLE: MapStyle = { style: 'streets' };

const LazyMapLibreMap = lazy(async () => {
  const mod = await loadMapLibreMap();
  return { default: mod.MapLibreMap };
});

export const ViewportStep: React.FC<ViewportStepProps> = ({
  value,
  mapStyle,
  onChange,
  mode,
  nodeId,
}) => {
  const readPersistedViewport = useCallback((): MapViewport | null => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<{
        longitude: number;
        latitude: number;
        zoom: number;
      }>;
      if (
        typeof parsed.longitude === 'number' &&
        Number.isFinite(parsed.longitude) &&
        typeof parsed.latitude === 'number' &&
        Number.isFinite(parsed.latitude) &&
        typeof parsed.zoom === 'number' &&
        Number.isFinite(parsed.zoom)
      ) {
        return {
          center: [parsed.longitude, parsed.latitude],
          zoom: parsed.zoom,
          bearing: 0,
          pitch: 0,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const persistViewportDefaults = useCallback((viewport: MapViewport) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          longitude: viewport.center[0],
          latitude: viewport.center[1],
          zoom: viewport.zoom,
        })
      );
    } catch {
      // ignore storage failures
    }
  }, []);

  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const initialViewStateRef = useRef<MapViewState | null>(null);
  const pendingSyncRef = useRef(false);
  const geolocationAppliedRef = useRef(false);
  const initialPersistedRef = useRef<MapViewport | null>(null);
  if (initialPersistedRef.current === null && typeof window !== 'undefined') {
    initialPersistedRef.current = readPersistedViewport();
  }
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);

  useEffect(() => {
    if (value) return;
    if (geolocationAppliedRef.current) return;

    const applyViewport = (next: MapViewport, persist = false) => {
      if (value) return;
      geolocationAppliedRef.current = true;
      pendingSyncRef.current = true;
      onChange(next);
      if (persist) {
        persistViewportDefaults(next);
      }
    };

    let cancelled = false;

    if (initialPersistedRef.current) {
      applyViewport(initialPersistedRef.current);
      return;
    }

    const canUseGeo =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation &&
      typeof navigator.geolocation.getCurrentPosition === 'function';

    if (canUseGeo) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled || value || geolocationAppliedRef.current) return;
          const { longitude, latitude, accuracy } = pos.coords;
          const boundedZoom =
            accuracy && Number.isFinite(accuracy) ? Math.max(5, Math.min(14, 16 - Math.log10(accuracy))) : 10;
          applyViewport({
            center: [longitude, latitude],
            zoom: boundedZoom,
            bearing: 0,
            pitch: 0,
          }, true);
        },
        () => {
          if (cancelled || value || geolocationAppliedRef.current) return;
          applyViewport(FALLBACK_VIEWPORT);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 60000,
        }
      );
    } else {
      applyViewport(FALLBACK_VIEWPORT);
    }

    return () => {
      cancelled = true;
    };
  }, [onChange, persistViewportDefaults, readPersistedViewport, value]);

  const vp: MapViewport = value || DEFAULT_GEO_VIEWPORT;
  const selectedStyle = mapStyle || DEFAULT_STYLE;
  if (!initialViewStateRef.current) {
    initialViewStateRef.current = {
      longitude: vp.center[0],
      latitude: vp.center[1],
      zoom: vp.zoom,
      bearing: vp.bearing ?? 0,
      pitch: 0,
    };
  }

  const setViewport = useCallback(
    (next: Partial<MapViewport>) => {
      onChange({
        ...vp,
        ...next,
        pitch: 0,
      });
    },
    [onChange, vp]
  );

  const setViewportFromInput = useCallback(
    (next: Partial<MapViewport>) => {
      pendingSyncRef.current = true;
      setViewport(next);
    },
    [setViewport]
  );

  const mapStyleSource = useMemo(
    () => resolveMapStyleSource(selectedStyle),
    [selectedStyle]
  );

  const resolvedNodeId = useMemo(() => {
    if (mode !== 'edit') return undefined;
    if (!nodeId || nodeId === 'undefined') return undefined;
    return nodeId as NodeId;
  }, [mode, nodeId]);
  const hasViewportValue = useMemo(() => {
    if (!value) return false;
    const [lng, lat] = value.center ?? [];
    return (
      Array.isArray(value.center) &&
      value.center.length === 2 &&
      Number.isFinite(lng) &&
      Number.isFinite(lat) &&
      Number.isFinite(value.zoom)
    );
  }, [value]);
  const shouldHydrateViewport = Boolean(resolvedNodeId) && mode === 'edit' && !hasViewportValue;
  const hydrationNodeId: NodeId | null =
    shouldHydrateViewport && resolvedNodeId ? resolvedNodeId : null;
  const { entity: baselineEntity } = useBaseMapEntity(hydrationNodeId, {
    skip: !hydrationNodeId,
  });

  useEffect(() => {
    if (!shouldHydrateViewport) return;
    if (!baselineEntity) return;
    pendingSyncRef.current = true;
    setViewport(baselineEntity.viewport ?? DEFAULT_GEO_VIEWPORT);
  }, [baselineEntity, shouldHydrateViewport, setViewport]);

  const handleViewStateChange = useCallback(
    (viewState: MapViewState) => {
      pendingSyncRef.current = false;
      const nextViewport: MapViewport = {
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom,
        bearing: viewState.bearing ?? 0,
        pitch: 0,
      };
      persistViewportDefaults(nextViewport);
      setViewport(nextViewport);
    },
    [persistViewportDefaults, setViewport]
  );

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    mapRef.current = map;
    setMapInstance(map);
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    const container = mapInstance.getContainer();
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!container.contains(target)) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const handleTouchMove = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!container.contains(target)) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [mapInstance]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!pendingSyncRef.current) return;
    mapRef.current.flyTo({
      center: vp.center as [number, number],
      zoom: vp.zoom,
      bearing: vp.bearing ?? 0,
      pitch: 0,
    });
    pendingSyncRef.current = false;
  }, [vp.center, vp.zoom, vp.bearing]);

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
        Fine-tune the initial viewport. Enter values directly or drag / zoom the map below.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ flexShrink: 0 }}>
        <TextField
          label="Longitude"
          type="number"
          inputProps={{ step: 0.0001, min: -180, max: 180 }}
          value={vp.center[0]}
          onChange={(e) =>
            setViewportFromInput({
              center: [Number(e.target.value), vp.center[1]],
            })
          }
          fullWidth
        />
        <TextField
          label="Latitude"
          type="number"
          inputProps={{ step: 0.0001, min: -90, max: 90 }}
          value={vp.center[1]}
          onChange={(e) =>
            setViewportFromInput({
              center: [vp.center[0], Number(e.target.value)],
            })
          }
          fullWidth
        />
        <TextField
          label="Zoom"
          type="number"
          inputProps={{ step: 0.1, min: 0, max: 24 }}
          value={vp.zoom}
          onChange={(e) => setViewportFromInput({ zoom: Number(e.target.value) })}
          fullWidth
        />
        <TextField
          label="Bearing"
          type="number"
          inputProps={{ step: 1, min: -180, max: 180 }}
          value={vp.bearing}
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
                Loading interactive map…
              </Typography>
            </Box>
          }
        >
          <LazyMapLibreMap
            initialViewState={initialViewStateRef.current!}
            mapStyle={mapStyleSource}
            width="100%"
            height="100%"
            mapOptions={{
              interactive: true,
              scrollZoom: true,
              dragPan: true,
              dragRotate: false,
              doubleClickZoom: true,
              touchZoomRotate: true,
            }}
            controls={{ navigation: { position: 'top-right' } }}
            onLoad={handleMapLoad}
            onViewStateChange={handleViewStateChange}
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
    </Box>
  );
};
