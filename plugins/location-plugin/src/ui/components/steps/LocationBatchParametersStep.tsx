/**
 * Batch parameter configuration step for Location dialog.
 */

import type React from 'react';
import { useEffect, useId, useMemo } from 'react';
import { Box, Grid, Slider, TextField, Typography } from '@mui/material';
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';

interface LocationBatchParametersStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
}

const SHARED_ZOOM_RANGE_KEY = 'sharedZoomRange';
const DEFAULT_SHARED_ZOOM_RANGE: [number, number] = [0, 6];
const SHARED_ZOOM_RANGE_MIN = 0;
const SHARED_ZOOM_RANGE_MAX = 22;

const normalizeSharedZoomRange = (value: unknown): [number, number] => {
  if (!Array.isArray(value) || value.length < 2) {
    return DEFAULT_SHARED_ZOOM_RANGE;
  }
  const rawMin = Number(value[0]);
  const rawMax = Number(value[1]);
  const min = Number.isFinite(rawMin) ? rawMin : DEFAULT_SHARED_ZOOM_RANGE[0];
  const max = Number.isFinite(rawMax) ? rawMax : DEFAULT_SHARED_ZOOM_RANGE[1];
  const clampedMin = Math.min(Math.max(min, SHARED_ZOOM_RANGE_MIN), SHARED_ZOOM_RANGE_MAX);
  const clampedMax = Math.min(Math.max(max, SHARED_ZOOM_RANGE_MIN), SHARED_ZOOM_RANGE_MAX);
  return clampedMin <= clampedMax ? [clampedMin, clampedMax] : [clampedMax, clampedMin];
};

const readSharedZoomRange = (): [number, number] => {
  if (typeof window === 'undefined') {
    return DEFAULT_SHARED_ZOOM_RANGE;
  }
  const stored = window.localStorage?.getItem(SHARED_ZOOM_RANGE_KEY);
  if (!stored) {
    return DEFAULT_SHARED_ZOOM_RANGE;
  }
  try {
    const parsed = JSON.parse(stored);
    return normalizeSharedZoomRange(parsed);
  } catch (error) {
    console.warn('[LocationBatchParametersStep] Failed to parse shared zoom range', error);
    return DEFAULT_SHARED_ZOOM_RANGE;
  }
};

const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;
const MIN_ZOOM_LEVEL = 0;
const MAX_ZOOM_LEVEL = 22;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const LocationBatchParametersStep: React.FC<LocationBatchParametersStepProps> = ({
  draft: draftProp,
  onUpdate,
}) => {
  const fieldId = useId();
  const { translations } = useTranslation();
  const draft = draftProp ?? {};
  const sharedZoomRange = useMemo(() => readSharedZoomRange(), []);

  const rawConcurrent = draft.concurrentDownloads ?? 2;
  const concurrentDownloads = clamp(Number(rawConcurrent) || 2, MIN_CONCURRENCY, MAX_CONCURRENCY);
  const [sharedMinZoom, sharedMaxZoom] = sharedZoomRange;
  const minZoom = clamp(sharedMinZoom, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
  const maxZoom = clamp(sharedMaxZoom, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);

  useEffect(() => {
    if (draft.tilesMinZoom !== minZoom || draft.tilesMaxZoom !== maxZoom) {
      onUpdate({ tilesMinZoom: minZoom, tilesMaxZoom: maxZoom });
    }
  }, [draft.tilesMinZoom, draft.tilesMaxZoom, maxZoom, minZoom, onUpdate]);

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
                id={`${fieldId}-min-zoom`}
                name="min-zoom"
                value={minZoom}
                inputProps={{ min: MIN_ZOOM_LEVEL, max: MAX_ZOOM_LEVEL, id: `${fieldId}-min-zoom`, name: 'min-zoom' }}
                onChange={handleMinZoomChange}
                disabled
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                type="number"
                label={translations.processing?.maxZoom ?? 'Max zoom'}
                id={`${fieldId}-max-zoom`}
                name="max-zoom"
                value={maxZoom}
                inputProps={{ min: MIN_ZOOM_LEVEL, max: MAX_ZOOM_LEVEL, id: `${fieldId}-max-zoom`, name: 'max-zoom' }}
                onChange={handleMaxZoomChange}
                disabled
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};
