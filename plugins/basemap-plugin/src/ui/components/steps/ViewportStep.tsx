import { Box, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { loadMapLibreMap, type MapLibreMapInstance, type MapViewState } from '@hierarchidb/ui-map';
import type { MapStyle, MapViewport } from '../../../common/types/BaseMapEntity.js';
import { resolveMapStyleSource } from '../../utils/mapStyle.js';

export interface ViewportStepProps {
  value: MapViewport | undefined;
  mapStyle?: MapStyle;
  onChange: (next: MapViewport) => void;
}

const DEFAULT_VIEWPORT: MapViewport = {
  center: [139.767, 35.681],
  zoom: 10,
  bearing: 0,
  pitch: 0,
};

const DEFAULT_STYLE: MapStyle = { style: 'streets' };

const LazyMapLibreMap = lazy(async () => {
  const mod = await loadMapLibreMap();
  return { default: mod.MapLibreMap };
});

export const ViewportStep: React.FC<ViewportStepProps> = ({ value, mapStyle, onChange }) => {
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const initialViewStateRef = useRef<MapViewState | null>(null);
  const pendingSyncRef = useRef(false);

  useEffect(() => {
    if (!value) {
      pendingSyncRef.current = true;
      onChange(DEFAULT_VIEWPORT);
    }
  }, [value, onChange]);

  const vp: MapViewport = value || DEFAULT_VIEWPORT;
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

  const handleViewStateChange = useCallback(
    (viewState: MapViewState) => {
      pendingSyncRef.current = false;
      setViewport({
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom,
        bearing: viewState.bearing ?? 0,
      });
    },
    [setViewport]
  );

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!pendingSyncRef.current) return;
    mapRef.current.jumpTo({
      center: vp.center as [number, number],
      zoom: vp.zoom,
      bearing: vp.bearing ?? 0,
      pitch: 0,
    });
    pendingSyncRef.current = false;
  }, [vp.center, vp.zoom, vp.bearing]);

  return (
    <Box sx={{ p: 2 }} onWheel={(event) => event.stopPropagation() }>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Fine-tune the initial viewport. Enter values directly or drag / zoom the map below.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
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
          height: 320,
          position: 'relative',
        }}
        onWheelCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
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
            onLoad={handleMapLoad}
            onViewStateChange={handleViewStateChange}
          />
        </Suspense>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 24,
            height: 24,
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: -12,
              right: -12,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.9)',
              transform: 'translateY(-50%)',
              boxShadow: '0 0 2px rgba(0,0,0,0.6)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: -12,
              bottom: -12,
              width: 1,
              backgroundColor: 'rgba(255,255,255,0.9)',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 2px rgba(0,0,0,0.6)',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};
