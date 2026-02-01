import { loadMapLibreMap } from '@hierarchidb/ui-map';
import { Box, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { lazy, Suspense } from 'react';
import type { MapStyle, MapViewport } from '../../../common/types/BaseMapEntity.js';
import { useViewportStep } from './useViewportStep.js';

export interface ViewportStepProps {
  value: MapViewport | undefined;
  mapStyle?: MapStyle;
  onChange: (next: MapViewport) => void;
}

const LazyMapLibreMap = lazy(async () => {
  const mod = await loadMapLibreMap();
  return { default: mod.MapLibreMap };
});

export const ViewportStep: React.FC<ViewportStepProps> = ({ value, mapStyle, onChange }) => {
  const {
    t,
    controlId,
    initial,
    viewState,
    canRenderMap,
    mapStyleProps,
    mapInteractionOptions,
    navigationControls,
    handleMapLoad,
    handleViewStateChange,
    handleViewStateChangeEnd,
    setViewportFromInput,
    formatCoord,
  } = useViewportStep({ value, mapStyle, onChange });

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
