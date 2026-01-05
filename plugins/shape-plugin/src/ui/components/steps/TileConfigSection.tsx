import { Accordion, AccordionDetails, AccordionSummary, Box, Card, CardContent, Grid, Stack, Typography, Slider, Tooltip } from '@mui/material';
import { Layers as LayersIcon, ExpandMore as ExpandMoreIcon, InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import type { BatchConfig, ShapeEntity } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useTileConfigSection } from '../../hooks/useTileConfigSection.js';
import { useBuildCrashInsight } from '../../hooks/useBuildCrashInsight.js';
import { getStageConcurrencyWarning } from '../../utils/buildWarnings.js';
import { useEffect, useMemo, useState } from 'react';

const SHARED_ZOOM_RANGE_KEY = 'sharedZoomRange';
const DEFAULT_SHARED_ZOOM_RANGE: [number, number] = [0, 7];
const DEFAULT_SHARED_ZOOM_SEGMENTS = 2;
const DEFAULT_SHARED_ZOOM_BREAKPOINTS: number[] = [0, 4, 7];
const SHARED_ZOOM_RANGE_MIN = 0;
const SHARED_ZOOM_RANGE_MAX = 12;
const SHARED_ZOOM_SEGMENT_MIN = 1;
const SHARED_ZOOM_SEGMENT_MAX = 6;

type SharedZoomConfig = {
  range: [number, number];
  segments: number;
  breakpoints: number[];
};

const clampRange = (range: [number, number]): [number, number] => {
  const min = Math.min(Math.max(range[0], SHARED_ZOOM_RANGE_MIN), SHARED_ZOOM_RANGE_MAX);
  const max = Math.min(Math.max(range[1], SHARED_ZOOM_RANGE_MIN), SHARED_ZOOM_RANGE_MAX);
  return min <= max ? [min, max] : [max, min];
};

const distributeBreakpoints = (range: [number, number], segments: number): number[] => {
  const [min, max] = range;
  if (segments <= 1 || min === max) {
    return [min, max];
  }
  const step = (max - min) / segments;
  const points = Array.from({ length: segments + 1 }, (_, index) => (
    Math.round(min + step * index)
  ));
  points[0] = min;
  points[points.length - 1] = max;
  return points;
};

const normalizeBreakpoints = (
  range: [number, number],
  segments: number,
  breakpoints?: number[],
): number[] => {
  const safeSegments = Math.min(Math.max(segments, SHARED_ZOOM_SEGMENT_MIN), SHARED_ZOOM_SEGMENT_MAX);
  const clampedRange = clampRange(range);
  const expectedLength = safeSegments + 1;
  if (!Array.isArray(breakpoints) || breakpoints.length !== expectedLength) {
    return distributeBreakpoints(clampedRange, safeSegments);
  }
  const sorted = [...breakpoints]
    .map((value) => Math.min(Math.max(Number(value), clampedRange[0]), clampedRange[1]))
    .sort((a, b) => a - b);
  sorted[0] = clampedRange[0];
  sorted[sorted.length - 1] = clampedRange[1];
  return sorted;
};

const normalizeSharedZoomConfig = (value: unknown): SharedZoomConfig => {
  if (Array.isArray(value)) {
    const range = clampRange([
      Number.isFinite(Number(value[0])) ? Number(value[0]) : DEFAULT_SHARED_ZOOM_RANGE[0],
      Number.isFinite(Number(value[1])) ? Number(value[1]) : DEFAULT_SHARED_ZOOM_RANGE[1],
    ]);
    const breakpoints = normalizeBreakpoints(range, DEFAULT_SHARED_ZOOM_SEGMENTS);
    return { range, segments: DEFAULT_SHARED_ZOOM_SEGMENTS, breakpoints };
  }
  if (value && typeof value === 'object') {
    const record = value as Partial<SharedZoomConfig>;
    const range = clampRange([
      Number.isFinite(Number(record.range?.[0])) ? Number(record.range?.[0]) : DEFAULT_SHARED_ZOOM_RANGE[0],
      Number.isFinite(Number(record.range?.[1])) ? Number(record.range?.[1]) : DEFAULT_SHARED_ZOOM_RANGE[1],
    ]);
    const segments = Number.isFinite(Number(record.segments))
      ? Number(record.segments)
      : DEFAULT_SHARED_ZOOM_SEGMENTS;
    const breakpoints = normalizeBreakpoints(range, segments, record.breakpoints);
    return { range, segments: Math.min(Math.max(segments, SHARED_ZOOM_SEGMENT_MIN), SHARED_ZOOM_SEGMENT_MAX), breakpoints };
  }
  return {
    range: DEFAULT_SHARED_ZOOM_RANGE,
    segments: DEFAULT_SHARED_ZOOM_SEGMENTS,
    breakpoints: DEFAULT_SHARED_ZOOM_BREAKPOINTS,
  };
};

const areNumberArraysEqual = (left?: number[], right?: number[]): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

const readSharedZoomConfig = (): SharedZoomConfig => {
  if (typeof window === 'undefined') {
    return normalizeSharedZoomConfig(null);
  }
  const stored = window.localStorage?.getItem(SHARED_ZOOM_RANGE_KEY);
  if (!stored) {
    return normalizeSharedZoomConfig(null);
  }
  try {
    const parsed = JSON.parse(stored);
    return normalizeSharedZoomConfig(parsed);
  } catch (error) {
    console.warn('[ShapeTileConfig] Failed to parse shared zoom config', error);
    return normalizeSharedZoomConfig(null);
  }
};

const persistSharedZoomConfig = (config: SharedZoomConfig): void => {
  if (typeof window === 'undefined') return;
  window.localStorage?.setItem(SHARED_ZOOM_RANGE_KEY, JSON.stringify(config));
};

type Props = {
  config: BatchConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const TileConfigSection: React.FC<Props> = ({ config, draft, disabled, onChange }) => {
  const { t } = useTranslation();
  const crashInsight = useBuildCrashInsight({
    draft,
    nodeId: draft?.nodeId ? String(draft.nodeId) : undefined,
  });
  const { baseTileConfig, update } = useTileConfigSection({ config, disabled, onChange });
  const sharedZoomConfig = useMemo(() => readSharedZoomConfig(), []);
  const [zoomConfig, setZoomConfig] = useState(sharedZoomConfig);
  const tileWarning = getStageConcurrencyWarning(
    crashInsight,
    'vectorTiles',
    baseTileConfig.workers,
  );
  const tileWarningText = tileWarning
    ? t(
      'processing.tile.memoryWarning',
      'Possible memory pressure: {{message}}',
      { message: tileWarning.message },
    )
    : undefined;

  useEffect(() => {
    const [sharedMin, sharedMax] = zoomConfig.range;
    const shouldSync = baseTileConfig.minZoom !== sharedMin
      || baseTileConfig.maxZoom !== sharedMax
      || !areNumberArraysEqual(baseTileConfig.zoomBreakpoints, zoomConfig.breakpoints);
    if (shouldSync) {
      update({
        tileConfig: {
          ...baseTileConfig,
          minZoom: sharedMin,
          maxZoom: sharedMax,
          zoomBreakpoints: zoomConfig.breakpoints,
        },
      });
    }
  }, [baseTileConfig, update, zoomConfig]);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <LayersIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.tile.title', 'Tile Generation Setting')}
          </Typography>
          <Tooltip
            title={t(
              'processing.tile.descriptionTooltip',
              'Generate vector tiles with zoom-aware extraction.',
            )}
            placement="top"
          >
            <InfoOutlinedIcon color="action" fontSize="small" />
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <WorkerNumberConfigCard
              icon={<LayersIcon fontSize="small" color="primary" />}
              title={t('processing.tile.workers', 'Tile Worker Count')}
              value={baseTileConfig.workers ?? 2}
              helperText={t('processing.tile.workersHelp', 'Parallel workers for tile generation.')}
              warningText={tileWarningText}
              onChange={(workers) =>
                update({
                  tileConfig: {
                    ...baseTileConfig,
                    workers,
                  },
                })
              }
              min={1}
              max={8}
              step={1}
              disabled={disabled}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 12 }}>
            <Card variant="outlined">
              <CardContent>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('processing.tile.zoomRange', 'Zoom Range')}
                    </Typography>
                    <Box sx={{ px: 2 }}>
                      <Slider
                        value={zoomConfig.range}
                        onChange={(_, value: number[]) => {
                          const rawRange = value as number[];
                          const nextMin = rawRange[0] ?? zoomConfig.range[0];
                          const nextMax = rawRange[1] ?? zoomConfig.range[1];
                          const nextRange = clampRange([nextMin, nextMax]);
                          const breakpoints = normalizeBreakpoints(nextRange, zoomConfig.segments, zoomConfig.breakpoints);
                          const nextConfig = {
                            range: nextRange,
                            segments: zoomConfig.segments,
                            breakpoints,
                          };
                          setZoomConfig(nextConfig);
                          persistSharedZoomConfig(nextConfig);
                        }}
                        min={SHARED_ZOOM_RANGE_MIN}
                        max={SHARED_ZOOM_RANGE_MAX}
                        step={1}
                        marks={[
                          { value: 0, label: '0' },
                          { value: 4, label: '4' },
                          { value: 8, label: '8' },
                          { value: 12, label: '12' },
                        ]}
                        valueLabelDisplay="auto"
                        disabled={disabled}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('processing.tile.zoomRangeHelp', 'Generate tiles within this zoom range.')}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('processing.tile.zoomSegments', 'Zoom Range Segments')}
                    </Typography>
                    <Box sx={{ px: 2 }}>
                      <Slider
                        value={zoomConfig.segments}
                        onChange={(_, value: number | number[]) => {
                          const nextSegments = Math.min(
                            Math.max(Number(value), SHARED_ZOOM_SEGMENT_MIN),
                            SHARED_ZOOM_SEGMENT_MAX,
                          );
                          const breakpoints = normalizeBreakpoints(zoomConfig.range, nextSegments);
                          const nextConfig = {
                            range: zoomConfig.range,
                            segments: nextSegments,
                            breakpoints,
                          };
                          setZoomConfig(nextConfig);
                          persistSharedZoomConfig(nextConfig);
                        }}
                        min={SHARED_ZOOM_SEGMENT_MIN}
                        max={SHARED_ZOOM_SEGMENT_MAX}
                        step={1}
                        marks
                        valueLabelDisplay="auto"
                        disabled={disabled}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('processing.tile.zoomSegmentsHelp', 'Number of zoom ranges to segment.')}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('processing.tile.zoomBreakpoints', 'Zoom Range Breakpoints')}
                    </Typography>
                    <Box sx={{ px: 2 }}>
                      <Slider
                        value={zoomConfig.breakpoints}
                        onChange={(_, value: number | number[]) => {
                          const values = Array.isArray(value) ? value : [Number(value)];
                          const nextBreakpoints = normalizeBreakpoints(zoomConfig.range, zoomConfig.segments, values);
                          const nextConfig = {
                            range: zoomConfig.range,
                            segments: zoomConfig.segments,
                            breakpoints: nextBreakpoints,
                          };
                          setZoomConfig(nextConfig);
                          persistSharedZoomConfig(nextConfig);
                        }}
                        min={SHARED_ZOOM_RANGE_MIN}
                        max={SHARED_ZOOM_RANGE_MAX}
                        step={1}
                        marks={[
                          { value: 0, label: '0' },
                          { value: 4, label: '4' },
                          { value: 8, label: '8' },
                          { value: 12, label: '12' },
                        ]}
                        valueLabelDisplay="auto"
                        disabled={disabled}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('processing.tile.zoomBreakpointsHelp', 'Set breakpoints inside the supported zoom range.')}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
            <Typography gutterBottom>
              {t('processing.tile.bufferSize', 'Tile Margin (px)')}
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={baseTileConfig.bufferSize ?? 256}
                onChange={(_, value: number | number[]) => {
                  const bufferSize = value as number;
                  update({
                    tileConfig: {
                      ...baseTileConfig,
                      bufferSize,
                    },
                  });
                }}
                min={0}
                max={512}
                step={32}
                marks={[{ value: 0, label: '0' }, { value: 256, label: '256' }, { value: 512, label: '512' }]}
                valueLabelDisplay="auto"
                disabled={disabled}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('processing.tile.bufferSizeHelp', 'Extra margin around tile edges to reduce visual seams.')}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
            <Typography gutterBottom>
              {t('processing.tile.expandFactor', 'Tile Expansion Factor')}
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={baseTileConfig.tileExpandFactor ?? 1}
                onChange={(_, value: number | number[]) => {
                  const tileExpandFactor = Number(value);
                  update({
                    tileConfig: {
                      ...baseTileConfig,
                      tileExpandFactor,
                    },
                  });
                }}
                min={0}
                max={3}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                  { value: 3, label: '3' },
                ]}
                valueLabelDisplay="auto"
                disabled={disabled}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('processing.tile.expandFactorHelp', 'Extra tiles to include around each group when building TopoJSON.')}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
            <Typography gutterBottom>
              {t('processing.tile.expandMargin', 'Tile Expansion Margin')}
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={baseTileConfig.tileExpandMargin ?? 0}
                onChange={(_, value: number | number[]) => {
                  const tileExpandMargin = Number(value);
                  update({
                    tileConfig: {
                      ...baseTileConfig,
                      tileExpandMargin,
                    },
                  });
                }}
                min={0}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 0.5, label: '0.5' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
                valueLabelDisplay="auto"
                disabled={disabled}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('processing.tile.expandMarginHelp', 'Additional margin in tile units for neighbor selection.')}
            </Typography>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
