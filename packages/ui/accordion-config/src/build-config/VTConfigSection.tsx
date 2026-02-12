import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  Tooltip,
  Slider,
  InputAdornment,
} from '@mui/material';
import {
  BorderAll as BorderAllIcon,
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoOutlinedIcon,
  Layers as LayersIcon,
  GridView as GridViewIcon,
  Speed as SpeedIcon,
  Tune as TuneIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  DensityLarge as DensityLargeIcon,
  DensitySmall as DensitySmallIcon,
  SquareFoot as SquareFootIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';
import { useEffect, useMemo } from 'react';
import type { BaseBuildConfig, DynamicConcurrencyConfig } from '@hierarchidb/gis-sdk';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { BuildConfigSectionTitle } from './BuildConfigSectionTitle.js';
import { getBuildConfigHoverCardSx } from './buildConfigCardStyles.js';

type TranslateFn = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

type Props<TDataSourceName = unknown> = {
  t: TranslateFn;
  buildConfig: BaseBuildConfig<TDataSourceName>;
  disabled?: boolean;
  update: (partial: Partial<BaseBuildConfig<TDataSourceName>>) => void;
  showConcurrencyCard?: boolean;
};

const createDefaultDynamicConcurrency = (maxConcurrent: number): DynamicConcurrencyConfig => ({
  enabled: false,
  minConcurrent: maxConcurrent,
  maxConcurrent,
  highWatermark: 0.85,
  lowWatermark: 0.6,
  adjustStep: 1,
  sampleMs: 2000,
});

export const VTConfigSection = <TDataSourceName,>({
  t,
  buildConfig,
  disabled,
  update,
  showConcurrencyCard = true,
}: Props<TDataSourceName>) => {
  const resolvedMaxConcurrent = Number.isFinite(buildConfig.vtConfig.maxConcurrent)
    ? buildConfig.vtConfig.maxConcurrent
    : 1;
  const dynamicConcurrency = useMemo(
    () => buildConfig.vtConfig.dynamicConcurrency
      ?? createDefaultDynamicConcurrency(resolvedMaxConcurrent),
    [buildConfig.vtConfig.dynamicConcurrency, resolvedMaxConcurrent],
  );
  const dynamicConcurrencyActive = showConcurrencyCard && resolvedMaxConcurrent >= 2;
  const tileToleranceMax = Math.max(10, buildConfig.vtConfig.tolerance);
  const hoverCardSx = getBuildConfigHoverCardSx(disabled);

  useEffect(() => {
    if (!showConcurrencyCard) return;
    if (dynamicConcurrency.enabled === dynamicConcurrencyActive) return;
    update({
      vtConfig: {
        ...buildConfig.vtConfig,
        dynamicConcurrency: {
          ...dynamicConcurrency,
          enabled: dynamicConcurrencyActive,
        },
      },
    });
  }, [buildConfig.vtConfig, dynamicConcurrency, dynamicConcurrencyActive, showConcurrencyCard, update]);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <LayersIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.vt.title', 'VT')}
          </Typography>
          <Tooltip
            title={t(
              'processing.tile.descriptionTooltip',
              'Generate VT tiles for the selected zoom range.',
            )}
            placement="top"
          >
            <InfoOutlinedIcon color="action" fontSize="small" />
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
            <Stack spacing={2}>
              <BuildConfigSectionTitle
                icon={<TuneIcon fontSize="small" color="primary" />}
                title={t('processing.tile.basicGeometry', 'Tile geometry & margin')}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.tile.extent', 'Tile extent')}
                    value={buildConfig.vtConfig.extent}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <GridViewIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    onChange={(event) => {
                      const extent = Number(event.target.value);
                      update({
                        vtConfig: {
                          ...buildConfig.vtConfig,
                          extent,
                        },
                      });
                    }}
                    helperText={t(
                      'processing.tile.extentHelp',
                      'Controls the resolution of tile coordinates.',
                    )}
                    inputProps={{ min: 0 }}
                    disabled={disabled}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.tile.tileSize', 'Tile size')}
                    value={buildConfig.vtConfig.tileSize}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SquareFootIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    onChange={(event) => {
                      const tileSize = Number(event.target.value);
                      update({
                        vtConfig: {
                          ...buildConfig.vtConfig,
                          tileSize,
                        },
                      });
                    }}
                    helperText={t(
                      'processing.tile.tileSizeHelp',
                      'Base tile size used for extent calculations.',
                    )}
                    inputProps={{ min: 0 }}
                    disabled={disabled}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {t('processing.tile.tolerance', 'Tile tolerance')}
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <DensitySmallIcon fontSize="small" color="action" />
                      <Slider
                        sx={{ flex: 1 }}
                        value={buildConfig.vtConfig.tolerance}
                        min={0}
                        max={tileToleranceMax}
                        step={0.1}
                        valueLabelDisplay="auto"
                        onChange={(_, value) => {
                          if (Array.isArray(value)) return;
                          const tolerance = Number(value);
                          if (!Number.isFinite(tolerance)) return;
                          update({
                            vtConfig: {
                              ...buildConfig.vtConfig,
                              tolerance,
                            },
                          });
                        }}
                        disabled={disabled}
                      />
                      <DensityLargeIcon fontSize="small" color="action" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'processing.tile.toleranceHelp',
                        'Simplification tolerance applied during tile generation.',
                      )}
                    </Typography>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.tile.bufferSize', 'Tile margin (px)')}
                    value={buildConfig.vtConfig.bufferSize}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BorderAllIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    onChange={(event) => {
                      const bufferSize = Number(event.target.value);
                      update({
                        vtConfig: {
                          ...buildConfig.vtConfig,
                          bufferSize,
                        },
                      });
                    }}
                    helperText={t(
                      'processing.tile.bufferSizeHelp',
                      '0 disables the margin. Larger values reduce seams but increase overlap.',
                    )}
                    inputProps={{ min: 0, max: 512 }}
                    disabled={disabled}
                  />
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          {showConcurrencyCard ? (
            <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
              <Stack spacing={2}>
                <BuildConfigSectionTitle
                  icon={<SpeedIcon fontSize="small" color="primary" />}
                  title={t('processing.tile.basicPerformance', 'Concurrency')}
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <WorkerNumberConfigCard
                      icon={<LayersIcon fontSize="small" color="primary" />}
                      title={t('processing.tile.workers', 'Concurrent VT Workers')}
                      value={resolvedMaxConcurrent}
                      helperText={t('processing.tile.workersHelp', 'Concurrent workers for VT generation.')}
                      warningText={undefined}
                      onChange={(maxConcurrent) =>
                        update({
                          vtConfig: {
                            ...buildConfig.vtConfig,
                            maxConcurrent,
                            dynamicConcurrency: {
                              ...dynamicConcurrency,
                              enabled: maxConcurrent >= 2,
                            },
                          },
                        })
                      }
                      min={1}
                      max={8}
                      step={1}
                      formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
                      disabled={disabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2">
                      {t('processing.tile.dynamicConcurrencyTitle', 'Dynamic VT concurrency')}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 8, lg: 6 }}>
                    <Stack spacing={1}>
                      <Typography variant="body2" fontWeight={600}>
                        {t('processing.tile.dynamicConcurrencyWatermarkRange', 'Watermark range')}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <ArrowDownwardIcon fontSize="small" color="action" />
                        <Slider
                          sx={{ flex: 1 }}
                          value={[
                            dynamicConcurrency.lowWatermark,
                            dynamicConcurrency.highWatermark,
                          ]}
                          min={0}
                          max={1}
                          step={0.01}
                          valueLabelDisplay="auto"
                          onChange={(_, value) => {
                            if (!Array.isArray(value) || value.length < 2) return;
                            const [lowValue, highValue] = value;
                            if (typeof lowValue !== 'number' || typeof highValue !== 'number') return;
                            if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) return;
                            const lowWatermark = Math.min(lowValue, highValue);
                            const highWatermark = Math.max(lowValue, highValue);
                            update({
                              vtConfig: {
                                ...buildConfig.vtConfig,
                                dynamicConcurrency: {
                                  ...dynamicConcurrency,
                                  lowWatermark,
                                  highWatermark,
                                },
                              },
                            });
                          }}
                          disabled={disabled || !dynamicConcurrencyActive}
                          getAriaLabel={() => t('processing.tile.dynamicConcurrencyWatermarkRange', 'Watermark range')}
                        />
                        <ArrowUpwardIcon fontSize="small" color="action" />
                      </Stack>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label={t('processing.tile.dynamicConcurrencyAdjustStep', 'Adjust step')}
                      value={dynamicConcurrency.adjustStep}
                      onChange={(event) => {
                        const adjustStep = Number(event.target.value);
                        update({
                          vtConfig: {
                            ...buildConfig.vtConfig,
                            dynamicConcurrency: {
                              ...dynamicConcurrency,
                              adjustStep: Number.isFinite(adjustStep)
                                ? adjustStep
                                : dynamicConcurrency.adjustStep,
                            },
                          },
                        });
                      }}
                      disabled={disabled || !dynamicConcurrencyActive}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label={t('processing.tile.dynamicConcurrencySampleMs', 'Sample interval (ms)')}
                      value={dynamicConcurrency.sampleMs}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <UpdateIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      onChange={(event) => {
                        const sampleMs = Number(event.target.value);
                        update({
                          vtConfig: {
                            ...buildConfig.vtConfig,
                            dynamicConcurrency: {
                              ...dynamicConcurrency,
                              sampleMs: Number.isFinite(sampleMs)
                                ? sampleMs
                                : dynamicConcurrency.sampleMs,
                            },
                          },
                        });
                      }}
                      disabled={disabled || !dynamicConcurrencyActive}
                    />
                  </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'processing.tile.dynamicConcurrencyHelp',
                    'Adjusts VT worker counts based on runtime load.',
                  )}
                </Typography>
              </Stack>
            </Paper>
          ) : null}

          <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
            <Stack spacing={2}>
              <BuildConfigSectionTitle
                icon={<TuneIcon fontSize="small" color="primary" />}
                title={t('processing.tile.memoryOverflowTitle', 'Memory Overflow Prevenstions')}
              />
              <TextField
                fullWidth
                type="number"
                label={t('processing.tile.indexMaxPoints', 'Index max points')}
                value={buildConfig.vtConfig.indexMaxPoints}
                onChange={(event) => {
                  const indexMaxPoints = Number(event.target.value);
                  update({
                    vtConfig: {
                      ...buildConfig.vtConfig,
                      indexMaxPoints,
                    },
                  });
                }}
                helperText={t(
                  'processing.tile.indexMaxPointsHelp',
                  '0 disables the limit. When exceeded, extra points are skipped from the tile index.',
                )}
                inputProps={{ min: 0 }}
                disabled={disabled}
              />
            </Stack>
          </Paper>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
