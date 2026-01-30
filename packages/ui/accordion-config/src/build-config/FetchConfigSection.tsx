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
import {
  CloudDownload as CloudDownloadIcon,
  ExpandMore as ExpandMoreIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import type { BaseBuildConfig, OmitDetailsLevel } from '@hierarchidb/gis-sdk';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { DownloadRetryControls } from './DownloadRetryControls.js';
import { BuildConfigSectionTitle } from './BuildConfigSectionTitle.js';
import { getBuildConfigHoverCardSx } from './buildConfigCardStyles.js';

type TranslateFn = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

type DetailPreset = {
  excludePolygonAreaCoefficient: number;
  minRingVertices: number;
};

type FilteringPreviewImages = Partial<Record<OmitDetailsLevel, string>>;

type Props<TBuildConfig extends BaseBuildConfig = BaseBuildConfig> = {
  t: TranslateFn;
  buildConfig: TBuildConfig;
  update: (partial: Partial<TBuildConfig>) => void;
  disabled?: boolean;
  filteringPreviewImages?: FilteringPreviewImages;
  detailPresets?: Partial<Record<OmitDetailsLevel, DetailPreset>>;
};

const DEFAULT_DETAIL_PRESETS: Record<OmitDetailsLevel, DetailPreset> = {
  weak: { excludePolygonAreaCoefficient: 0.5, minRingVertices: 4 },
  medium: { excludePolygonAreaCoefficient: 1, minRingVertices: 5 },
  strong: { excludePolygonAreaCoefficient: 2, minRingVertices: 6 },
};

const FILTERING_PREVIEW_LEVELS: OmitDetailsLevel[] = ['weak', 'medium', 'strong'];

export const FetchConfigSection = <TBuildConfig extends BaseBuildConfig>({
  t,
  buildConfig,
  update,
  disabled,
  filteringPreviewImages,
  detailPresets,
}: Props<TBuildConfig>) => {
  const baseFetchConfig = buildConfig.fetchConfig;
  const baseTransformConfig = buildConfig.transformConfig;
  const omitDetailsLevel = baseTransformConfig.omitDetailsConfig.level;
  const resolvedPresets = {
    ...DEFAULT_DETAIL_PRESETS,
    ...(detailPresets ?? {}),
  } as Record<OmitDetailsLevel, DetailPreset>;
  const previewItems = FILTERING_PREVIEW_LEVELS
    .map((level) => ({
      level,
      imageUrl: filteringPreviewImages?.[level],
    }))
    .filter((item) => Boolean(item.imageUrl));
  const showPreview = previewItems.length > 0;

  const applyDetailPreset = (level: OmitDetailsLevel): void => {
    const preset = resolvedPresets[level];
    update({
      transformConfig: {
        ...baseTransformConfig,
        omitDetailsConfig: {
          level,
        },
        excludePolygonAreaCoefficient: preset.excludePolygonAreaCoefficient,
        minRingVertices: preset.minRingVertices,
      },
    });
  };

  const hoverCardSx = getBuildConfigHoverCardSx(disabled);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CloudDownloadIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.fetch.title', 'Fetch')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Grid container rowSpacing={2} columnSpacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <WorkerNumberConfigCard
              title={t('processing.download.workers', 'Concurrent Fetch Workers')}
              value={baseFetchConfig.maxConcurrent}
              icon={<CloudDownloadIcon fontSize="small" color="primary" />}
              helperText={t('processing.download.workersHelp', 'Controls how many fetches run in parallel.')}
              warningText={undefined}
              onChange={(maxConcurrent) =>
                update({
                  fetchConfig: {
                    ...baseFetchConfig,
                    maxConcurrent,
                  },
                })
              }
              min={1}
              max={4}
              step={1}
              formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
              disabled={disabled}
            />
          </Grid>
          <DownloadRetryControls
            baseDownloadConfig={baseFetchConfig}
            disabled={disabled}
            onChange={(next) =>
              update({
                fetchConfig: next,
              })
            }
            t={t}
          />
          <Grid size={{ xs: 12 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">
                {t('processing.fetch.filteringTitle', 'Fetch-stage filtering')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(
                  'processing.fetch.filteringHelp',
                  'Applies to filtering at the end of the fetch stage before transform begins.',
                )}
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 2, ...hoverCardSx }}>
              <Stack spacing={2}>
                <BuildConfigSectionTitle
                  icon={<VisibilityOffIcon fontSize="small" color="primary" />}
                  title={t('processing.filter.omitDetailsTitle', 'Filtering small shapes (islands and enclaves)')}
                />
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'processing.filter.omitDetailsHelp',
                    'Filters out small shapes at each zoom using bbox and area thresholds.',
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'processing.filter.omitDetailsClarityNote',
                    'Low keeps more detail; High filters more aggressively.',
                  )}
                </Typography>
                {showPreview ? (
                  <>
                    <Typography variant="subtitle2">
                      {t('processing.filter.omitDetailsPreviewTitle', 'Filtering preview')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'processing.filter.omitDetailsPreviewHelp',
                        'Pick a level to see how smaller islands drop out as filtering strengthens.',
                      )}
                    </Typography>
                  </>
                ) : null}
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
                            borderColor: omitDetailsLevel === item.level ? 'primary.main' : 'divider',
                            bgcolor: omitDetailsLevel === item.level ? 'action.selected' : 'background.paper',
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
                                ? t('processing.filter.omitDetailsLevelWeakHelp', 'Keeps large, medium, and small islands.')
                                : item.level === 'medium'
                                  ? t('processing.filter.omitDetailsLevelMediumHelp', 'Keeps large and medium islands.')
                                  : t('processing.filter.omitDetailsLevelStrongHelp', 'Keeps only large islands.')}
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
                              sx={{ width: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
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
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
