import { Accordion, AccordionDetails, AccordionSummary, Box, Grid, Stack, Typography, Slider, Tooltip } from '@mui/material';
import { Layers as LayersIcon, ExpandMore as ExpandMoreIcon, InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import type { BatchConfig, ShapeEntity } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useTileConfigSection } from '../../hooks/useTileConfigSection.js';
import { useBuildCrashInsight } from '../../hooks/useBuildCrashInsight.js';
import { getStageConcurrencyWarning } from '../../utils/buildWarnings.js';
import { useEffect, useMemo } from 'react';

const SHARED_ZOOM_RANGE_KEY = 'sharedZoomRange';
const DEFAULT_SHARED_ZOOM_RANGE: [number, number] = [0, 8];
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
    console.warn('[ShapeTileConfig] Failed to parse shared zoom range', error);
    return DEFAULT_SHARED_ZOOM_RANGE;
  }
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
  const sharedZoomRange = useMemo(() => readSharedZoomRange(), []);
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
    const [sharedMin, sharedMax] = sharedZoomRange;
    if (baseTileConfig.minZoom !== sharedMin || baseTileConfig.maxZoom !== sharedMax) {
      update({
        tileConfig: {
          ...baseTileConfig,
          minZoom: sharedMin,
          maxZoom: sharedMax,
        },
      });
    }
  }, [baseTileConfig, sharedZoomRange, update]);

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
              'Generate vector tiles with zoom-aware simplification.',
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
              {t('processing.tile.zoomRange', 'Zoom Range')}
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={sharedZoomRange}
                onChange={(_, value: number[]) => {
                  const [nextMin, nextMax] = value as number[];
                  if(nextMin && nextMax) {
                    update({
                      tileConfig: {
                        ...baseTileConfig,
                        minZoom: nextMin,
                        maxZoom: nextMax,
                      },
                    });
                  }
                }}
                min={SHARED_ZOOM_RANGE_MIN}
                max={SHARED_ZOOM_RANGE_MAX}
                step={1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 4, label: '4' },
                  { value: 8, label: '8' },
                  { value: 12, label: '12' },
                  { value: 16, label: '16' },
                  { value: 20, label: '20' },
                  { value: 22, label: '22' },
                ]}
                valueLabelDisplay="auto"
                disabled
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('processing.tile.zoomRangeHelp', 'Generate tiles within this zoom range.')}
            </Typography>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
