import type React from 'react';
import { useEffect, useId } from 'react';
import { Box, Grid, Slider, TextField, Typography } from '@mui/material';
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';

interface LocationTileSettingsStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
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

export const LocationTileSettingsStep: React.FC<LocationTileSettingsStepProps> = ({
  draft: draftProp,
  onUpdate,
  disabled,
}) => {
  const fieldId = useId();
  const { translations } = useTranslation();
  const draft = draftProp ?? {};

  const rawWorkers = draft.tileWorkers ?? DEFAULT_WORKERS;
  const parsedWorkers = Number(rawWorkers);
  const tileWorkers = clamp(Number.isFinite(parsedWorkers) ? parsedWorkers : DEFAULT_WORKERS, MIN_WORKERS, MAX_WORKERS);

  const minZoom = clamp(draft.tilesMinZoom ?? DEFAULT_MIN_ZOOM, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
  const maxZoom = clamp(draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);

  useEffect(() => {
    const next: Partial<LocationEntity> = {};
    if (draft.tileWorkers == null) {
      next.tileWorkers = tileWorkers;
    }
    if (draft.tilesMinZoom == null || draft.tilesMaxZoom == null) {
      next.tilesMinZoom = minZoom;
      next.tilesMaxZoom = maxZoom;
    }
    if (Object.keys(next).length > 0) {
      onUpdate(next);
    }
  }, [draft.tileWorkers, draft.tilesMaxZoom, draft.tilesMinZoom, maxZoom, minZoom, onUpdate, tileWorkers]);

  const handleWorkersChange = (_: Event, value: number | number[]) => {
    const raw = Array.isArray(value) ? value[0] ?? tileWorkers : value ?? tileWorkers;
    const next = clamp(Number(raw), MIN_WORKERS, MAX_WORKERS);
    onUpdate({ tileWorkers: next });
  };

  const handleMinZoomChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = Number(event.target.value);
    const nextMin = clamp(raw, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
    const adjustedMax = Math.max(nextMin, maxZoom);
    onUpdate({ tilesMinZoom: nextMin, tilesMaxZoom: adjustedMax });
  };

  const handleMaxZoomChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = Number(event.target.value);
    const nextMax = clamp(raw, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
    const adjustedMin = Math.min(nextMax, minZoom);
    onUpdate({ tilesMinZoom: adjustedMin, tilesMaxZoom: nextMax });
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Typography variant="body2" color="text.secondary">
        {translations.tileSettings?.description ?? 'Configure vector tile generation workers and zoom range.'}
      </Typography>

      <Grid container spacing={3} columns={{ xs: 12 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography gutterBottom>
            {(translations.tileSettings?.workersLabel ?? 'Vector tile workers')}: {tileWorkers}
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
            {translations.tileSettings?.zoomLabel ?? 'Tile zoom range'}
          </Typography>
          <Grid container spacing={2} columns={{ xs: 12 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                type="number"
                label={translations.tileSettings?.minZoom ?? 'Min zoom'}
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
                label={translations.tileSettings?.maxZoom ?? 'Max zoom'}
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
