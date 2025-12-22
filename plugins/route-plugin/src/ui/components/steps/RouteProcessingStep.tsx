/**
 * RouteProcessingStep - Step 4 of route creation dialog.
 * Configures API throttle, simplification, and vector tile settings.
 */

import type React from 'react';
import { useId } from 'react';
import { Box, Grid, Slider, TextField, Typography } from '@mui/material';
import type { RouteEntity, RouteProcessingConfig, RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { useTranslation } from '../../../common/i18n/index.js';

export interface RouteProcessingStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
}

type ResolvedRouteProcessingConfig = {
  apiThrottle: {
    requestsPerSecond: number;
    maxConcurrent: number;
  };
  simplification: {
    tolerance: number;
  };
  vectorTiles: {
    minZoom: number;
    maxZoom: number;
    buffer: number;
  };
};

type RouteProcessingConfigUpdate = {
  apiThrottle?: Partial<ResolvedRouteProcessingConfig['apiThrottle']>;
  simplification?: Partial<ResolvedRouteProcessingConfig['simplification']>;
  vectorTiles?: Partial<ResolvedRouteProcessingConfig['vectorTiles']>;
};

const DEFAULT_CONFIG: RouteProcessingConfig = {
  apiThrottle: {
    requestsPerSecond: 5,
    maxConcurrent: 2,
  },
  simplification: {
    tolerance: 50,
  },
  vectorTiles: {
    minZoom: 4,
    maxZoom: 12,
    buffer: 8,
  },
};

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export const RouteProcessingStep: React.FC<RouteProcessingStepProps> = ({
  draft,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const fieldId = useId();
  const processing = (draft.draftData?.processing ?? {}) as RouteProcessingConfig;

  const mergedConfig: ResolvedRouteProcessingConfig = {
    apiThrottle: {
      requestsPerSecond:
        processing.apiThrottle?.requestsPerSecond ??
        DEFAULT_CONFIG.apiThrottle?.requestsPerSecond ??
        5,
      maxConcurrent:
        processing.apiThrottle?.maxConcurrent ??
        DEFAULT_CONFIG.apiThrottle?.maxConcurrent ??
        2,
    },
    simplification: {
      tolerance:
        processing.simplification?.tolerance ??
        DEFAULT_CONFIG.simplification?.tolerance ??
        50,
    },
    vectorTiles: {
      minZoom:
        processing.vectorTiles?.minZoom ??
        DEFAULT_CONFIG.vectorTiles?.minZoom ??
        4,
      maxZoom:
        processing.vectorTiles?.maxZoom ??
        DEFAULT_CONFIG.vectorTiles?.maxZoom ??
        12,
      buffer:
        processing.vectorTiles?.buffer ??
        DEFAULT_CONFIG.vectorTiles?.buffer ??
        8,
    },
  };

  const updateProcessing = (updates: RouteProcessingConfigUpdate) => {
    const nextProcessing: ResolvedRouteProcessingConfig = {
      apiThrottle: {
        ...mergedConfig.apiThrottle,
        ...(updates.apiThrottle ?? {}),
      },
      simplification: {
        ...mergedConfig.simplification,
        ...(updates.simplification ?? {}),
      },
      vectorTiles: {
        ...mergedConfig.vectorTiles,
        ...(updates.vectorTiles ?? {}),
      },
    };
    onUpdate({ processing: nextProcessing });
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Typography variant="h6">
        {t('processing.title', 'Processing Settings')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('processing.description', 'Tune the API usage and geometry settings for route generation.')}
      </Typography>

      <Grid container spacing={3} columns={{ xs: 12 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t('processing.apiThrottleTitle', 'API throttling')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('processing.apiThrottleDescription', 'Limit API calls to avoid rate limits.')}
          </Typography>
          <Typography variant="body2" gutterBottom>
            {t('processing.requestsPerSecond', 'Requests per second')}: {mergedConfig.apiThrottle.requestsPerSecond}
          </Typography>
          <Slider
            min={1}
            max={20}
            step={1}
            value={mergedConfig.apiThrottle.requestsPerSecond}
            valueLabelDisplay="auto"
            onChange={(_, value) => {
              const next = Array.isArray(value) ? value[0] ?? 5 : value ?? 5;
              updateProcessing({
                apiThrottle: {
                  requestsPerSecond: clamp(Number(next), 1, 20),
                },
              });
            }}
          />
          <TextField
            label={t('processing.maxConcurrent', 'Max concurrent requests')}
            type="number"
            value={mergedConfig.apiThrottle.maxConcurrent}
            inputProps={{ min: 1, max: 10 }}
            onChange={(event) => {
              const raw = Number(event.target.value);
              updateProcessing({
                apiThrottle: {
                  maxConcurrent: clamp(raw, 1, 10),
                },
              });
            }}
            fullWidth
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t('processing.simplificationTitle', 'Geometry simplification')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('processing.simplificationDescription', 'Reduce geometry complexity for faster rendering.')}
          </Typography>
          <Typography variant="body2" gutterBottom>
            {t('processing.tolerance', 'Tolerance')}: {mergedConfig.simplification.tolerance}
          </Typography>
          <Slider
            min={0}
            max={100}
            step={1}
            value={mergedConfig.simplification.tolerance}
            valueLabelDisplay="auto"
            onChange={(_, value) => {
              const next = Array.isArray(value) ? value[0] ?? 50 : value ?? 50;
              updateProcessing({
                simplification: {
                  tolerance: clamp(Number(next), 0, 100),
                },
              });
            }}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t('processing.vectorTilesTitle', 'Vector tile settings')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('processing.vectorTilesDescription', 'Configure zoom range and buffer for tile generation.')}
          </Typography>
          <Grid container spacing={2} columns={{ xs: 12 }}>
            <Grid size={{ xs: 4 }}>
              <TextField
                id={`${fieldId}-min-zoom`}
                label={t('processing.minZoom', 'Min zoom')}
                type="number"
                value={mergedConfig.vectorTiles.minZoom}
                inputProps={{ min: 0, max: 22 }}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  const nextMin = clamp(raw, 0, 22);
                  const nextMax = Math.max(nextMin, mergedConfig.vectorTiles.maxZoom);
                  updateProcessing({
                    vectorTiles: {
                      minZoom: nextMin,
                      maxZoom: nextMax,
                    },
                  });
                }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                id={`${fieldId}-max-zoom`}
                label={t('processing.maxZoom', 'Max zoom')}
                type="number"
                value={mergedConfig.vectorTiles.maxZoom}
                inputProps={{ min: 0, max: 22 }}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  const nextMax = clamp(raw, 0, 22);
                  const nextMin = Math.min(nextMax, mergedConfig.vectorTiles.minZoom);
                  updateProcessing({
                    vectorTiles: {
                      minZoom: nextMin,
                      maxZoom: nextMax,
                    },
                  });
                }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                id={`${fieldId}-buffer`}
                label={t('processing.buffer', 'Buffer (px)')}
                type="number"
                value={mergedConfig.vectorTiles.buffer}
                inputProps={{ min: 0, max: 128 }}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  updateProcessing({
                    vectorTiles: {
                      buffer: clamp(raw, 0, 128),
                    },
                  });
                }}
                fullWidth
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};
