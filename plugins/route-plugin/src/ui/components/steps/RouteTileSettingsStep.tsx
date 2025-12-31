import type React from 'react';
import { useEffect, useId } from 'react';
import { Box, Grid, Slider, TextField, Typography } from '@mui/material';
import type { RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { useTranslation } from '../../../common/i18n/index.js';

interface RouteTileSettingsStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteUpdaterPayload['draftData']>) => void;
  disabled?: boolean;
}

const MIN_WORKERS = 1;
const MAX_WORKERS = 16;
const MIN_ZOOM_LEVEL = 0;
const MAX_ZOOM_LEVEL = 22;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;
const DEFAULT_WORKERS = 4;

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export const RouteTileSettingsStep: React.FC<RouteTileSettingsStepProps> = ({ draft, onUpdate, disabled }) => {
  const fieldId = useId();
  const { t } = useTranslation();
  const vectorTiles = draft.draftData?.processing?.vectorTiles ?? {};
  const minZoom = clamp(vectorTiles.minZoom ?? DEFAULT_MIN_ZOOM, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
  const maxZoom = clamp(vectorTiles.maxZoom ?? DEFAULT_MAX_ZOOM, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
  const tileWorkers = clamp(vectorTiles.tileWorkers ?? DEFAULT_WORKERS, MIN_WORKERS, MAX_WORKERS);

  useEffect(() => {
    const next = {
      processing: {
        ...(draft.draftData?.processing ?? {}),
        vectorTiles: {
          ...vectorTiles,
          minZoom,
          maxZoom,
          tileWorkers,
        },
      },
      zoomRange: [minZoom, maxZoom] as [number, number],
    };
    onUpdate(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWorkersChange = (_: Event, value: number | number[]) => {
    const raw = Array.isArray(value) ? value[0] ?? tileWorkers : value ?? tileWorkers;
    const nextWorkers = clamp(Number(raw), MIN_WORKERS, MAX_WORKERS);
    onUpdate({
      processing: {
        ...(draft.draftData?.processing ?? {}),
        vectorTiles: {
          ...vectorTiles,
          tileWorkers: nextWorkers,
          minZoom,
          maxZoom,
        },
      },
    });
  };

  const handleMinZoomChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = Number(event.target.value);
    const nextMin = clamp(raw, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
    const adjustedMax = Math.max(nextMin, maxZoom);
    onUpdate({
      processing: {
        ...(draft.draftData?.processing ?? {}),
        vectorTiles: {
          ...vectorTiles,
          tileWorkers,
          minZoom: nextMin,
          maxZoom: adjustedMax,
        },
      },
      zoomRange: [nextMin, adjustedMax],
    });
  };

  const handleMaxZoomChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = Number(event.target.value);
    const nextMax = clamp(raw, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
    const adjustedMin = Math.min(nextMax, minZoom);
    onUpdate({
      processing: {
        ...(draft.draftData?.processing ?? {}),
        vectorTiles: {
          ...vectorTiles,
          tileWorkers,
          minZoom: adjustedMin,
          maxZoom: nextMax,
        },
      },
      zoomRange: [adjustedMin, nextMax],
    });
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Typography variant="body2" color="text.secondary">
        {t('tileSettings.description', 'Configure vector tile generation parameters.')}
      </Typography>

      <Grid container spacing={3} columns={{ xs: 12 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography gutterBottom>
            {t('tileSettings.workersLabel', 'Vector tile workers')}: {tileWorkers}
          </Typography>
          <Slider
            min={MIN_WORKERS}
            max={MAX_WORKERS}
            value={tileWorkers}
            valueLabelDisplay="auto"
            onChange={handleWorkersChange}
            disabled={disabled}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography gutterBottom>
            {t('tileSettings.zoomLabel', 'Tile zoom range')}
          </Typography>
          <Grid container spacing={2} columns={{ xs: 12 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                type="number"
                label={t('tileSettings.minZoom', 'Min zoom')}
                id={`${fieldId}-min-zoom`}
                name="min-zoom"
                value={minZoom}
                inputProps={{ min: MIN_ZOOM_LEVEL, max: MAX_ZOOM_LEVEL, id: `${fieldId}-min-zoom`, name: 'min-zoom' }}
                onChange={handleMinZoomChange}
                disabled={disabled}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                type="number"
                label={t('tileSettings.maxZoom', 'Max zoom')}
                id={`${fieldId}-max-zoom`}
                name="max-zoom"
                value={maxZoom}
                inputProps={{ min: MIN_ZOOM_LEVEL, max: MAX_ZOOM_LEVEL, id: `${fieldId}-max-zoom`, name: 'max-zoom' }}
                onChange={handleMaxZoomChange}
                disabled={disabled}
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};
