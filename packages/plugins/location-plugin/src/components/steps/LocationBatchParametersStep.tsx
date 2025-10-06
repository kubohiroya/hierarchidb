/**
 * Batch parameter configuration step for Location dialog.
 */

import type React from 'react';
import { Box, Grid, Slider, TextField, Typography } from '@mui/material';
import type { LocationWorkingCopy } from '../../types/index.js';
import { useTranslation } from '../../i18n/index.js';

interface LocationBatchParametersStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate: (updates: Partial<LocationWorkingCopy>) => void;
}

const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;
const MIN_ZOOM_LEVEL = 0;
const MAX_ZOOM_LEVEL = 22;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const LocationBatchParametersStep: React.FC<LocationBatchParametersStepProps> = ({ workingCopy, onUpdate }) => {
  const { translations } = useTranslation();
  const draft = workingCopy.payload?.draft ?? workingCopy;

  const rawConcurrent = draft.concurrentDownloads ?? workingCopy.concurrentDownloads ?? 2;
  const concurrentDownloads = clamp(Number(rawConcurrent) || 2, MIN_CONCURRENCY, MAX_CONCURRENCY);
  const rawMinZoom = (draft as any).tilesMinZoom ?? (workingCopy as any).tilesMinZoom ?? 4;
  const rawMaxZoom = (draft as any).tilesMaxZoom ?? (workingCopy as any).tilesMaxZoom ?? 12;
  const minZoom = clamp(Number(rawMinZoom) || 4, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
  const maxZoom = clamp(Number(rawMaxZoom) || 12, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);

  const handleConcurrentDownloadsChange = (_: Event, value: number | number[]) => {
    const rawValue = Array.isArray(value) ? value[0] ?? concurrentDownloads : value ?? concurrentDownloads;
    const next = clamp(rawValue, MIN_CONCURRENCY, MAX_CONCURRENCY);
    onUpdate({ concurrentDownloads: next });
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
        {translations.processing?.description ?? 'Configure download and tiling parameters for batch processing.'}
      </Typography>

      <Grid container spacing={3} columns={{ xs: 12 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography gutterBottom>
            {translations.processing?.concurrentDownloadsLabel ?? 'Concurrent Downloads'}: {concurrentDownloads}
          </Typography>
          <Slider
            min={MIN_CONCURRENCY}
            max={MAX_CONCURRENCY}
            value={concurrentDownloads}
            valueLabelDisplay="auto"
            onChange={handleConcurrentDownloadsChange}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography gutterBottom>
            {translations.processing?.tilingZoomLabel ?? 'Tile Zoom Range'}
          </Typography>
          <Grid container spacing={2} columns={{ xs: 12 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                type="number"
                label={translations.processing?.minZoom ?? 'Min zoom'}
                value={minZoom}
                inputProps={{ min: MIN_ZOOM_LEVEL, max: MAX_ZOOM_LEVEL }}
                onChange={handleMinZoomChange}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                type="number"
                label={translations.processing?.maxZoom ?? 'Max zoom'}
                value={maxZoom}
                inputProps={{ min: MIN_ZOOM_LEVEL, max: MAX_ZOOM_LEVEL }}
                onChange={handleMaxZoomChange}
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};
