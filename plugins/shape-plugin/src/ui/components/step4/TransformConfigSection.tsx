import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Grid,
  Stack,
  Typography,
  Paper,
  Slider,
  Tooltip,
  Switch,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  FilterAlt as FilterAltIcon,
  ExpandMore as ExpandMoreIcon,
  FilterAlt,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useTransformConfigSection } from './useTransformConfigSection.ts';
import { ExtractionPanel } from '../processing/ExtractionPanel.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Props = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const TransformConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const { t } = useTranslation();
  const {
    baseTransformConfig,
    update,
  } = useTransformConfigSection({ config, onChange });
  const omitDetailsLevel = baseTransformConfig.omitDetailsConfig.level;

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.extract1.title', 'Transform (Filtering)')}
          </Typography>
          <Tooltip
            title={t(
              'processing.extract1.omissionHelp',
              'When enabled, small features may be removed based on area threshold, minimum vertex count, or hybrid filtering.',
            )}
            placement="top"
          >
            <InfoOutlinedIcon color="action" fontSize="small" />
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <WorkerNumberConfigCard
                icon={<FilterAlt fontSize="small" color="primary" />}
                title={t('processing.filter.workersStage1', 'Transform Workers (Filtering)')}
                value={baseTransformConfig.maxConcurrent}
                helperText={t('processing.filter.workersStage1Help', 'Parallel workers for transform filtering.')}
                warningText={undefined}
                onChange={(maxConcurrent) =>
                  update({
                    transformConfig: {
                      ...baseTransformConfig,
                      maxConcurrent,
                    },
                  })
                }
                min={1}
                max={8}
                step={1}
                disabled={disabled}
              />
            </Grid>
          </Grid>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {t('processing.filter.omitDetailsTitle', 'Detail omission')}
                  </Typography>
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
          </Grid>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {t('processing.filter.excludePolygonAreaCoefficient', 'Polygon Area Exclusion Coefficient')}
                  </Typography>
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
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <ExtractionPanel
                  tolerance={baseTransformConfig.tolerance}
                  toleranceLabelKey="processing.filter.tolerancePrimary"
                  onToleranceChange={(tolerance) =>
                    update({
                      transformConfig: {
                        ...baseTransformConfig,
                        tolerance,
                      },
                    })
                  }
                  min={0}
                  max={1}
                  step={0.01}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 0.05, label: '0.05' },
                    { value: 0.1, label: '0.1' },
                    { value: 0.25, label: '0.25' },
                    { value: 0.5, label: '0.5' },
                    { value: 0.75, label: '0.75' },
                    { value: 1, label: '1.0' },
                  ]}
                  showPerFeatureToggle={false}
                  disabled={disabled}
                />
              </Paper>
            </Grid>
          </Grid>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {t('processing.filter.preSimplifyTitle', 'Pre-simplify Filters')}
                  </Typography>
                  <Stack spacing={1}>
                    <FormControlLabel
                      control={(
                        <Switch
                          checked={baseTransformConfig.preSimplifyFilterConfig.excludeInvalidGeometry}
                          onChange={(event) => {
                            update({
                              transformConfig: {
                                ...baseTransformConfig,
                                preSimplifyFilterConfig: {
                                  ...baseTransformConfig.preSimplifyFilterConfig,
                                  excludeInvalidGeometry: event.target.checked,
                                },
                              },
                            });
                          }}
                        />
                      )}
                      label={t('processing.filter.excludeInvalidGeometry', 'Exclude invalid geometry')}
                      disabled={disabled}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'processing.filter.excludeInvalidGeometryHelp',
                        'Drops features with non-finite coordinates, open rings, or invalid polygons before simplify.',
                      )}
                    </Typography>
                  </Stack>
                  <Stack spacing={1}>
                    <FormControlLabel
                      control={(
                        <Switch
                          checked={baseTransformConfig.preSimplifyFilterConfig.dropInvalidHoles}
                          onChange={(event) => {
                            update({
                              transformConfig: {
                                ...baseTransformConfig,
                                preSimplifyFilterConfig: {
                                  ...baseTransformConfig.preSimplifyFilterConfig,
                                  dropInvalidHoles: event.target.checked,
                                },
                              },
                            });
                          }}
                        />
                      )}
                      label={t('processing.filter.dropInvalidHoles', 'Drop invalid holes')}
                      disabled={disabled}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'processing.filter.dropInvalidHolesHelp',
                        'When a hole ring is invalid, only the hole is removed instead of dropping the polygon.',
                      )}
                    </Typography>
                  </Stack>
                  <Stack spacing={1}>
                    <FormControlLabel
                      control={(
                        <Switch
                          checked={baseTransformConfig.preSimplifyFilterConfig.splitSelfIntersections}
                          onChange={(event) => {
                            update({
                              transformConfig: {
                                ...baseTransformConfig,
                                preSimplifyFilterConfig: {
                                  ...baseTransformConfig.preSimplifyFilterConfig,
                                  splitSelfIntersections: event.target.checked,
                                },
                              },
                            });
                          }}
                        />
                      )}
                      label={t('processing.filter.splitSelfIntersections', 'Split self-intersections')}
                      disabled={disabled}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'processing.filter.splitSelfIntersectionsHelp',
                        'Splits self-intersecting polygons before simplify to avoid geometry errors.',
                      )}
                    </Typography>
                  </Stack>
                  <Stack spacing={1}>
                    <FormControlLabel
                      control={(
                        <Switch
                          checked={baseTransformConfig.preSimplifyFilterConfig.dropSmallPolygons}
                          onChange={(event) => {
                            update({
                              transformConfig: {
                                ...baseTransformConfig,
                                preSimplifyFilterConfig: {
                                  ...baseTransformConfig.preSimplifyFilterConfig,
                                  dropSmallPolygons: event.target.checked,
                                },
                              },
                            });
                          }}
                        />
                      )}
                      label={t('processing.filter.dropSmallPolygons', 'Drop tiny polygons')}
                      disabled={disabled}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'processing.filter.dropSmallPolygonsHelp',
                        'Removes polygons below the minimum area or vertex thresholds instead of simplifying them.',
                      )}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
