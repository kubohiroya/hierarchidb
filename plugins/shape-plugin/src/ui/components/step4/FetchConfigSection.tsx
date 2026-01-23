import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Grid,
  Paper,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  CropSquare as CropSquareIcon,
  ExpandMore as ExpandMoreIcon,
  Straighten as StraightenIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { DownloadRetryControls } from './DownloadRetryControls.js';
import type { FetchConfigSectionState } from './useFetchConfigSection.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { PrecisionPanel } from '../processing/PrecisionPanel.js';
import type { ReactNode } from 'react';

type Props = {
  fetchState: FetchConfigSectionState;
  config: ShapeBuildConfig;
  disabled?: boolean;
};

const SectionTitle: React.FC<{ icon: ReactNode; title: string }> = ({ icon, title }) => (
  <Stack direction="row" spacing={1} alignItems="center">
    {icon}
    <Typography variant="subtitle2">{title}</Typography>
  </Stack>
);

export const FetchConfigSection: React.FC<Props> = ({ fetchState, config, disabled }) => {
  const { t, baseFetchConfig, update } = fetchState;
  const baseTransformConfig = config.transformConfig;
  const omitDetailsLevel = baseTransformConfig.omitDetailsConfig.level;
  const quantizeRank = Math.min(5, Math.max(1, Math.round(baseTransformConfig.quantize ?? 1)));
  const quantizeOptions = [1, 2, 3, 4, 5];
  const quantizeLabel = `x${Math.pow(2, quantizeRank - 1)}`;

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
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
              <Stack spacing={2}>
                <SectionTitle
                  icon={<StraightenIcon fontSize="small" color="primary" />}
                  title={t('processing.filter.precisionTitle', 'Precision & Compression')}
                />
                <PrecisionPanel
                  quantize={quantizeRank}
                  quantizeOptions={quantizeOptions}
                  quantizeRank={quantizeRank}
                  quantizeLabel={quantizeLabel}
                  disabled={disabled}
                  onQuantizeChange={(quantize) =>
                    update({
                      transformConfig: {
                        ...baseTransformConfig,
                        quantize,
                      },
                    })
                  }
                />
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 12, md: 8, lg: 9 }}>
            <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
              <Stack spacing={2}>
                <SectionTitle
                  icon={<VisibilityOffIcon fontSize="small" color="primary" />}
                  title={t('processing.filter.omitDetailsTitle', 'Detail omission')}
                />
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'processing.filter.omitDetailsHelp',
                    'Drops polygons that are too small to be visible at each zoom level using bbox and outer-ring area thresholds.',
                  )}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={omitDetailsLevel}
                  onChange={(_, value) => {
                    if (!value) return;
                    const nextLevel = value as typeof omitDetailsLevel;
                    update({
                      transformConfig: {
                        ...baseTransformConfig,
                        omitDetailsConfig: {
                          level: nextLevel,
                        },
                      },
                    });
                  }}
                  disabled={disabled}
                >
                  <ToggleButton value="weak">
                    {t('processing.filter.omitDetailsLevelWeak', 'Low')}
                  </ToggleButton>
                  <ToggleButton value="medium">
                    {t('processing.filter.omitDetailsLevelMedium', 'Medium')}
                  </ToggleButton>
                  <ToggleButton value="strong">
                    {t('processing.filter.omitDetailsLevelStrong', 'High')}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 12, md: 8, lg: 9 }}>
            <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
              <Stack spacing={2}>
                <SectionTitle
                  icon={<CropSquareIcon fontSize="small" color="primary" />}
                  title={t('processing.filter.excludePolygonAreaCoefficient', 'Polygon Area Exclusion Coefficient')}
                />
                <div>
                  <Typography gutterBottom>
                    {t('processing.filter.excludePolygonAreaCoefficient', 'Polygon Area Exclusion Coefficient')}
                  </Typography>
                  <Box sx={{ px: 2 }}>
                    <Slider
                      value={baseTransformConfig.excludePolygonAreaCoefficient}
                      onChange={(_, value) => {
                        const excludePolygonAreaCoefficient = value as number;
                        update({
                          transformConfig: {
                            ...baseTransformConfig,
                            excludePolygonAreaCoefficient,
                          },
                        });
                      }}
                      min={0}
                      max={5}
                      step={0.1}
                      valueLabelDisplay="auto"
                      marks={[
                        { value: 0, label: '0' },
                        { value: 0.5, label: '0.5' },
                        { value: 1, label: '1.0' },
                        { value: 2, label: '2.0' },
                        { value: 5, label: '5.0' },
                      ]}
                      disabled={disabled}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      'processing.filter.excludePolygonAreaCoefficientHelp',
                      'Excludes polygons smaller than coefficient × grid size × outline length / 2 after quantization.',
                    )}
                  </Typography>
                </div>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
              <Stack spacing={2}>
                <SectionTitle
                  icon={<StraightenIcon fontSize="small" color="primary" />}
                  title={t('processing.filter.ringFixMinRingVertices', 'Min ring vertices')}
                />
                <TextField
                  fullWidth
                  type="number"
                  label={t('processing.filter.ringFixMinRingVertices', 'Min ring vertices')}
                  value={baseTransformConfig.ringFixConfig.minRingVertices}
                  onChange={(event) => {
                    const minRingVertices = Number(event.target.value);
                    update({
                      transformConfig: {
                        ...baseTransformConfig,
                        ringFixConfig: {
                          ...baseTransformConfig.ringFixConfig,
                          minRingVertices: Number.isFinite(minRingVertices)
                            ? minRingVertices
                            : baseTransformConfig.ringFixConfig.minRingVertices,
                        },
                      },
                    });
                  }}
                  disabled={disabled}
                />
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
