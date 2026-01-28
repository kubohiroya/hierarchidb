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
import {
  filteringHighUrl,
  filteringLowUrl,
  filteringMediumUrl,
} from '../../assets/filtering-samples/filteringSamples.ts';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { DownloadRetryControls } from './DownloadRetryControls.js';
import type { FetchConfigSectionState } from './useFetchConfigSection.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import type { ReactNode } from 'react';
import { Step4SectionTitle } from './Step4SectionTitle.tsx';
import { getStep4HoverCardSx } from './step4CardStyles.ts';

type OmitDetailsLevel = ShapeBuildConfig['transformConfig']['omitDetailsConfig']['level'];

type Props = {
  fetchState: FetchConfigSectionState;
  config: ShapeBuildConfig;
  disabled?: boolean;
};

  <Stack direction="row" spacing={1} alignItems="center">
    <Typography variant="subtitle2">{title}</Typography>
);

export const FetchConfigSection: React.FC<Props> = ({ fetchState, config, disabled }) => {
  const { t, baseFetchConfig, update } = fetchState;
  const baseTransformConfig = config.transformConfig;
  const omitDetailsLevel = baseTransformConfig.omitDetailsConfig.level;
  const detailPresets: Record<OmitDetailsLevel, { excludePolygonAreaCoefficient: number; minRingVertices: number }> = {
    weak: { excludePolygonAreaCoefficient: 0.5, minRingVertices: 4 },
    medium: { excludePolygonAreaCoefficient: 1, minRingVertices: 5 },
    strong: { excludePolygonAreaCoefficient: 2, minRingVertices: 6 },
  };

  const applyDetailPreset = (level: OmitDetailsLevel): void => {
    const preset = detailPresets[level];
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

  const hoverCardSx = getStep4HoverCardSx(disabled);

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
              disabled={disabled}
            />
          </Grid>
          <DownloadRetryControls
            baseDownloadConfig={baseFetchConfig}
            disabled={disabled}
            update={update}
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
                <Step4SectionTitle
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
                <Typography variant="subtitle2">
                  {t('processing.filter.omitDetailsPreviewTitle', 'Filtering preview')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'processing.filter.omitDetailsPreviewHelp',
                    'Pick a level to see how smaller islands drop out as filtering strengthens.',
                  )}
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box
                      onClick={() => !disabled && applyDetailPreset('weak')}
                      sx={{
                        p: 2,
                        borderRadius: 1,
                        border: 2,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        borderColor: omitDetailsLevel === 'weak' ? 'primary.main' : 'divider',
                        bgcolor: omitDetailsLevel === 'weak' ? 'action.selected' : 'background.paper',
                        opacity: disabled ? 0.5 : 1,
                        '&:hover': disabled ? {} : { bgcolor: 'action.hover' },
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography variant="subtitle2">
                          {t('processing.filter.omitDetailsLevelWeak', 'High detail')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('processing.filter.omitDetailsLevelWeakHelp', 'Keeps large, medium, and small islands.')}
                        </Typography>
                        <Box
                          component="img"
                          src={filteringLowUrl}
                          alt={t('processing.filter.omitDetailsLevelWeak', 'High detail')}
                          sx={{ width: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                        />
                      </Stack>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box
                      onClick={() => !disabled && applyDetailPreset('medium')}
                      sx={{
                        p: 2,
                        borderRadius: 1,
                        border: 2,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        borderColor: omitDetailsLevel === 'medium' ? 'primary.main' : 'divider',
                        bgcolor: omitDetailsLevel === 'medium' ? 'action.selected' : 'background.paper',
                        opacity: disabled ? 0.5 : 1,
                        '&:hover': disabled ? {} : { bgcolor: 'action.hover' },
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography variant="subtitle2">
                          {t('processing.filter.omitDetailsLevelMedium', 'Medium detail')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('processing.filter.omitDetailsLevelMediumHelp', 'Keeps large and medium islands.')}
                        </Typography>
                        <Box
                          component="img"
                          src={filteringMediumUrl}
                          alt={t('processing.filter.omitDetailsLevelMedium', 'Medium detail')}
                          sx={{ width: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                        />
                      </Stack>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box
                      onClick={() => !disabled && applyDetailPreset('strong')}
                      sx={{
                        p: 2,
                        borderRadius: 1,
                        border: 2,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        borderColor: omitDetailsLevel === 'strong' ? 'primary.main' : 'divider',
                        bgcolor: omitDetailsLevel === 'strong' ? 'action.selected' : 'background.paper',
                        opacity: disabled ? 0.5 : 1,
                        '&:hover': disabled ? {} : { bgcolor: 'action.hover' },
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography variant="subtitle2">
                          {t('processing.filter.omitDetailsLevelStrong', 'Low detail')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('processing.filter.omitDetailsLevelStrongHelp', 'Keeps only large islands.')}
                        </Typography>
                        <Box
                          component="img"
                          src={filteringHighUrl}
                          alt={t('processing.filter.omitDetailsLevelStrong', 'Low detail')}
                          sx={{ width: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                        />
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
