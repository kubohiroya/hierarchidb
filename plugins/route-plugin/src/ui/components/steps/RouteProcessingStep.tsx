/**
 * RouteProcessingStep - Step 4 of route creation dialog.
 * Configures API throttle, extraction, and vector tile settings.
 */

import type React from 'react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Box, Button, Grid, Slider, TextField, Typography } from '@mui/material';
import type { RouteEntity, RouteProcessingConfig, RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { useTranslation } from '../../../common/i18n/index.js';
import type { NodeId } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { RouteDB } from '../../../services/database/RouteDatabase.js';
import { clearBuildMonitor, getBuildMonitorKey } from '@hierarchidb/ui-monitoring';

export interface RouteProcessingStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  nodeId?: NodeId;
  disabled?: boolean;
}

const SHARED_ZOOM_RANGE_KEY = 'sharedZoomRange';
const DEFAULT_SHARED_ZOOM_RANGE: [number, number] = [0, 6];
const SHARED_ZOOM_RANGE_MIN = 0;
const SHARED_ZOOM_RANGE_MAX = 22;
const buildMonitorConfig = {
  storagePrefix: 'hdb:route:build-monitor',
  keyMode: 'node',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
} as const;

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
    console.warn('[RouteProcessingStep] Failed to parse shared zoom range', error);
    return DEFAULT_SHARED_ZOOM_RANGE;
  }
};

type ResolvedRouteProcessingConfig = {
  apiThrottle: {
    requestsPerSecond: number;
    maxConcurrent: number;
  };
  extraction: {
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
  extraction?: Partial<ResolvedRouteProcessingConfig['extraction']>;
  vectorTiles?: Partial<ResolvedRouteProcessingConfig['vectorTiles']>;
};

const DEFAULT_CONFIG: RouteProcessingConfig = {
  apiThrottle: {
    requestsPerSecond: 5,
    maxConcurrent: 2,
  },
  extraction: {
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
  nodeId,
  disabled,
}) => {
  const { t } = useTranslation();
  const fieldId = useId();
  const { api, initialize } = useWorkerAPI();
  const [lineCount, setLineCount] = useState(0);
  const monitorKey = useMemo(
    () => getBuildMonitorKey(buildMonitorConfig, nodeId ? String(nodeId) : null),
    [nodeId],
  );
  const processing = (draft.draftData?.processing ?? {}) as RouteProcessingConfig;
  const sharedZoomRange = useMemo(() => readSharedZoomRange(), []);

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
    extraction: {
      tolerance:
        processing.extraction?.tolerance ??
        DEFAULT_CONFIG.extraction?.tolerance ??
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

  const updateProcessing = useCallback((updates: RouteProcessingConfigUpdate) => {
    const nextProcessing: ResolvedRouteProcessingConfig = {
      apiThrottle: {
        ...mergedConfig.apiThrottle,
        ...(updates.apiThrottle ?? {}),
      },
      extraction: {
        ...mergedConfig.extraction,
        ...(updates.extraction ?? {}),
      },
      vectorTiles: {
        ...mergedConfig.vectorTiles,
        ...(updates.vectorTiles ?? {}),
      },
    };
    onUpdate({ config: nextProcessing });
  }, [mergedConfig.apiThrottle, mergedConfig.extraction, mergedConfig.vectorTiles, onUpdate]);

  const loadCounts = useCallback(async () => {
    if (!nodeId) {
      setLineCount(0);
      return;
    }
    const db = new RouteDB();
    const count = await db.features.where('nodeId').equals(nodeId).count().catch(() => 0);
    setLineCount(count);
  }, [nodeId]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  const handleDeleteLineStrings = useCallback(async () => {
    if (!nodeId) {
      notify.warning(t('processing.cleanupMissingNode', 'NodeId is missing.'));
      return;
    }
    if (!api) {
      notify.error(t('processing.cleanupMissingApi', 'Worker API is unavailable.'));
      return;
    }
    await initialize();
    const mutation = await api.getRouteMutationAPI();
    await mutation.deleteRouteLineStrings(nodeId);
    if (monitorKey) {
      clearBuildMonitor(buildMonitorConfig, monitorKey);
    }
    onUpdate({
      processingStatus: undefined,
      processingError: undefined,
      processedAt: undefined,
      buildStartedAt: undefined,
      buildFinishedAt: undefined,
    });
    await loadCounts();
    notify.success(t('processing.cleanupDone', 'Deleted route line data.'));
  }, [api, initialize, loadCounts, monitorKey, nodeId, onUpdate, t]);

  useEffect(() => {
    const [sharedMin, sharedMax] = sharedZoomRange;
    if (mergedConfig.vectorTiles.minZoom !== sharedMin || mergedConfig.vectorTiles.maxZoom !== sharedMax) {
      updateProcessing({
        vectorTiles: {
          minZoom: sharedMin,
          maxZoom: sharedMax,
        },
      });
    }
  }, [mergedConfig.vectorTiles.maxZoom, mergedConfig.vectorTiles.minZoom, sharedZoomRange, updateProcessing]);

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
            {t('processing.extractionTitle', 'Geometry extraction')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('processing.extractionDescription', 'Reduce geometry complexity for faster rendering.')}
          </Typography>
          <Typography variant="body2" gutterBottom>
            {t('processing.tolerance', 'Tolerance')}: {mergedConfig.extraction.tolerance}
          </Typography>
          <Slider
            min={0}
            max={100}
            step={1}
            value={mergedConfig.extraction.tolerance}
            valueLabelDisplay="auto"
            onChange={(_, value) => {
              const next = Array.isArray(value) ? value[0] ?? 50 : value ?? 50;
              updateProcessing({
                extraction: {
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
                disabled
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
                disabled
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

      <Box display="flex" flexDirection="column" gap={2}>
        <Typography variant="subtitle1">
          {t('processing.cleanupTitle', 'Cleanup')}
        </Typography>
        <Grid container spacing={2} columns={{ xs: 12 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Button
              variant="outlined"
              fullWidth
              disabled={disabled || lineCount === 0}
              onClick={handleDeleteLineStrings}
            >
              {t('processing.deleteLineStrings', 'Delete route line data ({count})').replace('{count}', String(lineCount))}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};
