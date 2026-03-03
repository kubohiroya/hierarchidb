import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  Slider,
  InputAdornment,
} from '@mui/material';
import {
  BorderAll as BorderAllIcon,
  ExpandMore as ExpandMoreIcon,
  Layers as LayersIcon,
  GridView as GridViewIcon,
  Speed as SpeedIcon,
  Tune as TuneIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  DensityLarge as DensityLargeIcon,
  DensitySmall as DensitySmallIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';
import type { ReactNode } from 'react';
import type { BaseBuildConfig } from '@hierarchidb/gis-sdk';
import { BuildConfigAccordionSummary } from './BuildConfigAccordionSummary.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { BuildConfigSectionTitle } from './BuildConfigSectionTitle.js';
import { useTileEmitConfigSection } from './useTileEmitConfigSection.js';

type TranslateFn = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

type Props<TDataSourceName = unknown> = {
  t: TranslateFn;
  buildConfig: BaseBuildConfig<TDataSourceName>;
  disabled?: boolean;
  update: (partial: Partial<BaseBuildConfig<TDataSourceName>>) => void;
  showConcurrencyCard?: boolean;
  disableHoverLift?: boolean;
  additionalCards?: ReactNode;
};

export const TileEmitConfigSection = <TDataSourceName,>({
  t,
  buildConfig,
  disabled,
  update,
  showConcurrencyCard = true,
  disableHoverLift = false,
  additionalCards,
}: Props<TDataSourceName>) => {
  const {
    resolvedMaxConcurrent,
    dynamicConcurrency,
    dynamicConcurrencyActive,
    tileToleranceMax,
    hoverCardSx,
    onExtentChange,
    onToleranceChange,
    onBufferChange,
    onIndexMaxPointsChange,
    onMaxConcurrentChange,
    onWatermarkRangeChange,
    onAdjustStepChange,
    onSampleMsChange,
  } = useTileEmitConfigSection({
    buildConfig,
    disabled,
    disableHoverLift,
    showConcurrencyCard,
    update,
  });

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <BuildConfigAccordionSummary
          icon={<LayersIcon color="primary" />}
          title={t('processing.tileEmit.title', 'TileEmit generation')}
          info={t(
            'processing.tile.descriptionTooltip',
            'Generate TileEmit outputs for the selected zoom range.',
          )}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1 }}>
        <Stack spacing={3}>
          {additionalCards ? (
            <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
              {additionalCards}
            </Paper>
          ) : null}

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
                    value={buildConfig.tileEmitConfig.extent}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <GridViewIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    onChange={(event) => onExtentChange(event.target.value)}
                    helperText={t(
                      'processing.tile.extentHelp',
                      'Controls the resolution of tile coordinates.',
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
                        value={buildConfig.tileEmitConfig.tolerance}
                        min={0}
                        max={tileToleranceMax}
                        step={0.1}
                        valueLabelDisplay="auto"
                        onChange={(_, value) => onToleranceChange(value)}
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
                    label={t('processing.tile.buffer', 'Tile buffer (px)')}
                    value={buildConfig.tileEmitConfig.buffer ?? buildConfig.tileEmitConfig.bufferSize ?? 64}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BorderAllIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    onChange={(event) => onBufferChange(event.target.value)}
                    helperText={t(
                      'processing.tile.bufferHelp',
                      'Tile buffer on each side in px.',
                    )}
                    inputProps={{ min: 0, max: 512 }}
                    disabled={disabled}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.tile.indexMaxPoints', 'Index max points')}
                    value={buildConfig.tileEmitConfig.indexMaxPoints}
                    onChange={(event) => onIndexMaxPointsChange(event.target.value)}
                    helperText={t(
                      'processing.tile.indexMaxPointsHelp',
                      'Maximum number of points per tile in the initial index.',
                    )}
                    inputProps={{ min: 1 }}
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
                      title={t('processing.tile.workers', 'Concurrent TileEmit Workers')}
                      value={resolvedMaxConcurrent}
                      helperText={t('processing.tile.workersHelp', 'Concurrent workers for TileEmit generation.')}
                      warningText={undefined}
                      disableHoverEffect={disableHoverLift}
                      onChange={onMaxConcurrentChange}
                      min={1}
                      max={8}
                      step={1}
                      formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
                      disabled={disabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2">
                      {t('processing.tile.dynamicConcurrencyTitle', 'Dynamic TileEmit concurrency')}
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
                          onChange={(_, value) => onWatermarkRangeChange(value)}
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
                      onChange={(event) => onAdjustStepChange(event.target.value)}
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
                      onChange={(event) => onSampleMsChange(event.target.value)}
                      disabled={disabled || !dynamicConcurrencyActive}
                    />
                  </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'processing.tile.dynamicConcurrencyHelp',
                    'Adjusts TileEmit worker counts based on runtime load.',
                  )}
                </Typography>
              </Stack>
            </Paper>
          ) : null}

        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
