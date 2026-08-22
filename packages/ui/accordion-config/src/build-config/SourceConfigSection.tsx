import type { BaseBuildConfig, OmitDetailsLevel } from '@hierarchidb/gis-sdk';
import {
  CloudDownload as CloudDownloadIcon,
  ExpandMore as ExpandMoreIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { BuildConfigAccordionSummary } from './BuildConfigAccordionSummary.js';
import { BuildConfigSectionTitle } from './BuildConfigSectionTitle.js';
import { getBuildConfigHoverCardSx } from './buildConfigCardStyles.js';
import { type DownloadRetryConfig, DownloadRetryControls } from './DownloadRetryControls.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';

type TranslateFn = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

type DetailPreset = {
  excludePolygonAreaCoefficient: number;
  minRingVertices: number;
};

type FilteringPreviewImages = Partial<Record<OmitDetailsLevel, string>>;

type Props<TDataSourceName = unknown> = {
  t: TranslateFn;
  buildConfig: BaseBuildConfig<TDataSourceName>;
  update: (partial: Partial<BaseBuildConfig<TDataSourceName>>) => void;
  disabled?: boolean;
  showConcurrencyCard?: boolean;
  showRetryCard?: boolean;
  filteringPreviewImages?: FilteringPreviewImages;
  detailPresets?: Partial<Record<OmitDetailsLevel, DetailPreset>>;
  fetchRetryConfig?: DownloadRetryConfig;
  onFetchRetryConfigChange?: (next: DownloadRetryConfig) => void;
  additionalCards?: ReactNode;
  disableHoverLift?: boolean;
};

const DEFAULT_DETAIL_PRESETS: Record<OmitDetailsLevel, DetailPreset> = {
  weak: { excludePolygonAreaCoefficient: 0.5, minRingVertices: 4 },
  medium: { excludePolygonAreaCoefficient: 1, minRingVertices: 5 },
  strong: { excludePolygonAreaCoefficient: 2, minRingVertices: 6 },
};

const FILTERING_PREVIEW_LEVELS: OmitDetailsLevel[] = ['weak', 'medium', 'strong'];

export const SourceConfigSection = <TDataSourceName,>({
  t,
  buildConfig,
  update,
  disabled,
  showConcurrencyCard = true,
  showRetryCard = true,
  filteringPreviewImages,
  detailPresets,
  fetchRetryConfig,
  onFetchRetryConfigChange,
  additionalCards,
  disableHoverLift = false,
}: Props<TDataSourceName>) => {
  const baseFetchConfig = buildConfig.sourceConfig;
  const baseTransformConfig = buildConfig.geometryConfig;
  const omitDetailsLevel = baseTransformConfig.omitDetailsConfig.level;
  const resolvedPresets = {
    ...DEFAULT_DETAIL_PRESETS,
    ...(detailPresets ?? {}),
  } as Record<OmitDetailsLevel, DetailPreset>;
  const previewItems = FILTERING_PREVIEW_LEVELS.map((level) => ({
    level,
    imageUrl: filteringPreviewImages?.[level],
  })).filter((item) => Boolean(item.imageUrl));
  const showPreview = previewItems.length > 0;
  const resolvedRetryConfig: DownloadRetryConfig = fetchRetryConfig ?? {
    timeoutMs: baseFetchConfig.timeoutMs,
    retryAttempts: baseFetchConfig.retryAttempts,
    retryDelay: baseFetchConfig.retryDelay,
    retryLimit: baseFetchConfig.retryLimit,
    retryBackoff: baseFetchConfig.retryBackoff,
  };

  const applyDetailPreset = (level: OmitDetailsLevel): void => {
    const preset = resolvedPresets[level];
    update({
      geometryConfig: {
        ...baseTransformConfig,
        omitDetailsConfig: {
          level,
        },
        excludePolygonAreaCoefficient: preset.excludePolygonAreaCoefficient,
        minRingVertices: preset.minRingVertices,
      },
    });
  };

  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <BuildConfigAccordionSummary
          icon={<CloudDownloadIcon color="primary" />}
          title={t('processing.source.title', 'Source')}
          info={t(
            'processing.source.descriptionTooltip',
            'Loads source data, applies intake filtering, and prepares input for Geometry.'
          )}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1 }}>
        <Grid container rowSpacing={2} columnSpacing={2}>
          {showConcurrencyCard ? (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <WorkerNumberConfigCard
                title={t('processing.download.workers', 'Concurrent Source Workers')}
                value={baseFetchConfig.maxConcurrent}
                icon={<CloudDownloadIcon fontSize="small" color="primary" />}
                helperText={t(
                  'processing.download.workersHelp',
                  'Controls how many source tasks run in parallel.'
                )}
                warningText={undefined}
                onChange={(maxConcurrent) =>
                  update({
                    sourceConfig: {
                      ...baseFetchConfig,
                      maxConcurrent,
                    },
                  })
                }
                min={1}
                max={4}
                step={1}
                formatLabel={(value) =>
                  t('processing.workers.countLabel', '{{count}} workers', { count: value })
                }
                disabled={disabled}
              />
            </Grid>
          ) : null}
          {showRetryCard ? (
            <DownloadRetryControls
              baseRetryConfig={resolvedRetryConfig}
              disabled={disabled}
              onChange={(next) => {
                if (onFetchRetryConfigChange) {
                  onFetchRetryConfigChange(next);
                  return;
                }
                update({
                  sourceConfig: {
                    ...baseFetchConfig,
                    ...next,
                  },
                });
              }}
              t={t}
            />
          ) : null}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 2, ...hoverCardSx }}>
              <Stack spacing={2}>
                <BuildConfigSectionTitle
                  icon={<VisibilityOffIcon fontSize="small" color="primary" />}
                  title={t(
                    'processing.filter.omitDetailsTitle',
                    'Filtering small shapes (islands and enclaves)'
                  )}
                />
                {showPreview ? (
                  <Grid container spacing={2}>
                    {previewItems.map((item) => (
                      <Grid key={item.level} size={{ xs: 12, md: 4 }}>
                        <Box
                          onClick={() => !disabled && applyDetailPreset(item.level)}
                          sx={{
                            p: 2,
                            borderRadius: 1,
                            border: 2,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            borderColor:
                              omitDetailsLevel === item.level ? 'primary.main' : 'divider',
                            bgcolor:
                              omitDetailsLevel === item.level
                                ? 'action.selected'
                                : 'background.paper',
                            opacity: disabled ? 0.5 : 1,
                            '&:hover': disabled ? {} : { bgcolor: 'action.hover' },
                          }}
                        >
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">
                              {item.level === 'weak'
                                ? t('processing.filter.omitDetailsLevelWeak', 'High detail')
                                : item.level === 'medium'
                                  ? t('processing.filter.omitDetailsLevelMedium', 'Medium detail')
                                  : t('processing.filter.omitDetailsLevelStrong', 'Low detail')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.level === 'weak'
                                ? t(
                                    'processing.filter.omitDetailsLevelWeakHelp',
                                    'Keeps large, medium, and small islands.'
                                  )
                                : item.level === 'medium'
                                  ? t(
                                      'processing.filter.omitDetailsLevelMediumHelp',
                                      'Keeps large and medium islands.'
                                    )
                                  : t(
                                      'processing.filter.omitDetailsLevelStrongHelp',
                                      'Keeps only large islands.'
                                    )}
                            </Typography>
                            <Box
                              component="img"
                              src={item.imageUrl}
                              alt={
                                item.level === 'weak'
                                  ? t('processing.filter.omitDetailsLevelWeak', 'High detail')
                                  : item.level === 'medium'
                                    ? t('processing.filter.omitDetailsLevelMedium', 'Medium detail')
                                    : t('processing.filter.omitDetailsLevelStrong', 'Low detail')
                              }
                              sx={{
                                width: '100%',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            />
                          </Stack>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                ) : null}
              </Stack>
            </Paper>
          </Grid>
          {additionalCards ? <Grid size={{ xs: 12 }}>{additionalCards}</Grid> : null}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
