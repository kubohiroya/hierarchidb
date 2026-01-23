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
  TextField,
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
import { PrecisionPanel } from '../processing/PrecisionPanel.js';
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
  const quantizeRank = Math.min(5, Math.max(1, Math.round(baseTransformConfig.quantize ?? 1)));
  const quantizeOptions = [1, 2, 3, 4, 5];
  const quantizeLabel = `x${Math.pow(2, quantizeRank - 1)}`;
  const transformModeValue = baseTransformConfig.transformMode ?? 'full';

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
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {t('processing.filter.areaFilterTitle', 'Area Filter')}
                  </Typography>
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={baseTransformConfig.enableFeatureFiltering}
                        onChange={(event) => {
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              enableFeatureFiltering: event.target.checked,
                            },
                          });
                        }}
                        disabled={disabled}
                      />
                    )}
                    label={t('processing.filter.enableFeatureFiltering', 'Enable feature filtering')}
                  />
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={baseTransformConfig.featureFilterMethod}
                    onChange={(_, value) => {
                      if (!value) return;
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          featureFilterMethod: value,
                        },
                      });
                    }}
                    disabled={disabled || !baseTransformConfig.enableFeatureFiltering}
                  >
                    <ToggleButton value="none">
                      {t('processing.filter.methodNone', 'Pass-through')}
                    </ToggleButton>
                    <ToggleButton value="bbox_only">
                      {t('processing.filter.methodBBox', 'Bounding Box Only (Fastest)')}
                    </ToggleButton>
                    <ToggleButton value="polygon_only">
                      {t('processing.filter.methodPolygon', 'Polygon Only')}
                    </ToggleButton>
                    <ToggleButton value="hybrid">
                      {t('processing.filter.methodHybrid', 'Hybrid (Recommended)')}
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      'processing.filter.methodHelp',
                      'Selects how small features are filtered before transform.',
                    )}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {t('processing.filter.areaFilterTitle', 'Area Filter')}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('processing.filter.minimumArea', 'Minimum Area (sq km)')}
                        value={baseTransformConfig.featureAreaThreshold}
                        onChange={(event) => {
                          const featureAreaThreshold = Number(event.target.value);
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              featureAreaThreshold: Number.isFinite(featureAreaThreshold)
                                ? featureAreaThreshold
                                : baseTransformConfig.featureAreaThreshold,
                            },
                          });
                        }}
                        helperText={t(
                          'processing.filter.minimumAreaHelp',
                          'Filters out features smaller than this area during transform.',
                        )}
                        disabled={disabled || !baseTransformConfig.enableFeatureFiltering}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('processing.filter.minVertexCount', 'Min Vertex Count')}
                        value={baseTransformConfig.minVertexCountForAreaFilter}
                        onChange={(event) => {
                          const minVertexCountForAreaFilter = Number(event.target.value);
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              minVertexCountForAreaFilter: Number.isFinite(minVertexCountForAreaFilter)
                                ? minVertexCountForAreaFilter
                                : baseTransformConfig.minVertexCountForAreaFilter,
                            },
                          });
                        }}
                        helperText={t(
                          'processing.filter.minVertexCountHelp',
                          'Only apply area filtering when feature vertices exceed this count.',
                        )}
                        disabled={disabled || !baseTransformConfig.enableFeatureFiltering}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('processing.filter.aspectRatioThreshold', 'Aspect Ratio Threshold')}
                        value={baseTransformConfig.aspectRatioThreshold}
                        onChange={(event) => {
                          const aspectRatioThreshold = Number(event.target.value);
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              aspectRatioThreshold: Number.isFinite(aspectRatioThreshold)
                                ? aspectRatioThreshold
                                : baseTransformConfig.aspectRatioThreshold,
                            },
                          });
                        }}
                        helperText={t(
                          'processing.filter.aspectRatioThresholdHelp',
                          'Filters elongated features when their aspect ratio exceeds this value.',
                        )}
                        disabled={disabled || !baseTransformConfig.enableFeatureFiltering}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('processing.filter.areaThreshold', 'Area Threshold (sq km)')}
                        value={baseTransformConfig.areaThreshold}
                        onChange={(event) => {
                          const areaThreshold = Number(event.target.value);
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              areaThreshold: Number.isFinite(areaThreshold)
                                ? areaThreshold
                                : baseTransformConfig.areaThreshold,
                            },
                          });
                        }}
                        helperText={t(
                          'processing.filter.areaThresholdHelp',
                          'Minimum area used with aspect ratio filtering.',
                        )}
                        disabled={disabled || !baseTransformConfig.enableFeatureFiltering}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {t('processing.filter.hybridFilterTitle', 'Hybrid filter tuning')}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('processing.filter.quickRejectThreshold', 'Quick Reject Threshold')}
                        value={baseTransformConfig.hybridFilterConfig.quickRejectThreshold}
                        onChange={(event) => {
                          const quickRejectThreshold = Number(event.target.value);
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              hybridFilterConfig: {
                                ...baseTransformConfig.hybridFilterConfig,
                                quickRejectThreshold: Number.isFinite(quickRejectThreshold)
                                  ? quickRejectThreshold
                                  : baseTransformConfig.hybridFilterConfig.quickRejectThreshold,
                              },
                            },
                          });
                        }}
                        helperText={t(
                          'processing.filter.quickRejectHelp',
                          'Lower values reject more tiny features quickly.',
                        )}
                        disabled={disabled || !baseTransformConfig.enableFeatureFiltering}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('processing.filter.simpleShapeVertexThreshold', 'Simple Shape Vertex Threshold')}
                        value={baseTransformConfig.hybridFilterConfig.simpleShapeVertexThreshold}
                        onChange={(event) => {
                          const simpleShapeVertexThreshold = Number(event.target.value);
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              hybridFilterConfig: {
                                ...baseTransformConfig.hybridFilterConfig,
                                simpleShapeVertexThreshold: Number.isFinite(simpleShapeVertexThreshold)
                                  ? simpleShapeVertexThreshold
                                  : baseTransformConfig.hybridFilterConfig.simpleShapeVertexThreshold,
                              },
                            },
                          });
                        }}
                        helperText={t(
                          'processing.filter.simpleShapeVertexHelp',
                          'Vertex count threshold for simple-shape handling.',
                        )}
                        disabled={disabled || !baseTransformConfig.enableFeatureFiltering}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('processing.filter.elongatedShapeCorrectionFactor', 'Elongated Shape Correction Factor')}
                        value={baseTransformConfig.hybridFilterConfig.elongatedShapeCorrectionFactor}
                        onChange={(event) => {
                          const elongatedShapeCorrectionFactor = Number(event.target.value);
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              hybridFilterConfig: {
                                ...baseTransformConfig.hybridFilterConfig,
                                elongatedShapeCorrectionFactor: Number.isFinite(elongatedShapeCorrectionFactor)
                                  ? elongatedShapeCorrectionFactor
                                  : baseTransformConfig.hybridFilterConfig.elongatedShapeCorrectionFactor,
                              },
                            },
                          });
                        }}
                        helperText={t(
                          'processing.filter.elongatedShapeHelp',
                          'Correction factor for elongated simple shapes.',
                        )}
                        disabled={disabled || !baseTransformConfig.enableFeatureFiltering}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('processing.filter.regularShapeMinRatio', 'Regular Shape Min Ratio')}
                        value={baseTransformConfig.hybridFilterConfig.regularShapeMinRatio}
                        onChange={(event) => {
                          const regularShapeMinRatio = Number(event.target.value);
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              hybridFilterConfig: {
                                ...baseTransformConfig.hybridFilterConfig,
                                regularShapeMinRatio: Number.isFinite(regularShapeMinRatio)
                                  ? regularShapeMinRatio
                                  : baseTransformConfig.hybridFilterConfig.regularShapeMinRatio,
                              },
                            },
                          });
                        }}
                        helperText={t(
                          'processing.filter.regularShapeMinRatioHelp',
                          'Minimum ratio considered a regular-shaped feature.',
                        )}
                        disabled={disabled || !baseTransformConfig.enableFeatureFiltering}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('processing.filter.regularShapeMaxRatio', 'Regular Shape Max Ratio')}
                        value={baseTransformConfig.hybridFilterConfig.regularShapeMaxRatio}
                        onChange={(event) => {
                          const regularShapeMaxRatio = Number(event.target.value);
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              hybridFilterConfig: {
                                ...baseTransformConfig.hybridFilterConfig,
                                regularShapeMaxRatio: Number.isFinite(regularShapeMaxRatio)
                                  ? regularShapeMaxRatio
                                  : baseTransformConfig.hybridFilterConfig.regularShapeMaxRatio,
                              },
                            },
                          });
                        }}
                        helperText={t(
                          'processing.filter.regularShapeMaxRatioHelp',
                          'Maximum ratio considered a regular-shaped feature.',
                        )}
                        disabled={disabled || !baseTransformConfig.enableFeatureFiltering}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
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
              </Paper>
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
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {t('processing.filter.selfIntersectionTuningTitle', 'Self-intersection tuning')}
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.filter.selfIntersectionDisableZoom', 'Disable fix at zoom or below')}
                    value={baseTransformConfig.selfIntersectionTuningConfig.disableAtZoomOrBelow}
                    onChange={(event) => {
                      const disableAtZoomOrBelow = Number(event.target.value);
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          selfIntersectionTuningConfig: {
                            ...baseTransformConfig.selfIntersectionTuningConfig,
                            disableAtZoomOrBelow: Number.isFinite(disableAtZoomOrBelow)
                              ? disableAtZoomOrBelow
                              : baseTransformConfig.selfIntersectionTuningConfig.disableAtZoomOrBelow,
                          },
                        },
                      });
                    }}
                    disabled={disabled}
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.filter.selfIntersectionMaxVerticesForFix', 'Max vertices for fix')}
                    value={baseTransformConfig.selfIntersectionTuningConfig.maxVerticesForFix}
                    onChange={(event) => {
                      const maxVerticesForFix = Number(event.target.value);
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          selfIntersectionTuningConfig: {
                            ...baseTransformConfig.selfIntersectionTuningConfig,
                            maxVerticesForFix: Number.isFinite(maxVerticesForFix)
                              ? maxVerticesForFix
                              : baseTransformConfig.selfIntersectionTuningConfig.maxVerticesForFix,
                          },
                        },
                      });
                    }}
                    disabled={disabled}
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.filter.selfIntersectionMaxVerticesForSplit', 'Max vertices for split')}
                    value={baseTransformConfig.selfIntersectionTuningConfig.maxVerticesForSplit}
                    onChange={(event) => {
                      const maxVerticesForSplit = Number(event.target.value);
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          selfIntersectionTuningConfig: {
                            ...baseTransformConfig.selfIntersectionTuningConfig,
                            maxVerticesForSplit: Number.isFinite(maxVerticesForSplit)
                              ? maxVerticesForSplit
                              : baseTransformConfig.selfIntersectionTuningConfig.maxVerticesForSplit,
                          },
                        },
                      });
                    }}
                    disabled={disabled}
                  />
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {t('processing.filter.selfIntersectionHandlingTitle', 'Self-intersection handling')}
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={baseTransformConfig.selfIntersectionConfig.strategy}
                    onChange={(_, value) => {
                      if (!value) return;
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          selfIntersectionConfig: {
                            ...baseTransformConfig.selfIntersectionConfig,
                            strategy: value,
                          },
                        },
                      });
                    }}
                    disabled={disabled}
                  >
                    <ToggleButton value="keep_largest">
                      {t('processing.filter.selfIntersectionKeepLargest', 'Keep largest')}
                    </ToggleButton>
                    <ToggleButton value="keep_all">
                      {t('processing.filter.selfIntersectionKeepAll', 'Keep all')}
                    </ToggleButton>
                    <ToggleButton value="keep_outer">
                      {t('processing.filter.selfIntersectionKeepOuter', 'Keep outer')}
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.filter.selfIntersectionMinPolygonAreaMultiplier', 'Min polygon area multiplier')}
                    value={baseTransformConfig.selfIntersectionConfig.minPolygonAreaMultiplier}
                    onChange={(event) => {
                      const minPolygonAreaMultiplier = Number(event.target.value);
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          selfIntersectionConfig: {
                            ...baseTransformConfig.selfIntersectionConfig,
                            minPolygonAreaMultiplier: Number.isFinite(minPolygonAreaMultiplier)
                              ? minPolygonAreaMultiplier
                              : baseTransformConfig.selfIntersectionConfig.minPolygonAreaMultiplier,
                          },
                        },
                      });
                    }}
                    disabled={disabled}
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.filter.selfIntersectionMaxPolygons', 'Max polygons')}
                    value={baseTransformConfig.selfIntersectionConfig.maxPolygons}
                    onChange={(event) => {
                      const maxPolygons = Number(event.target.value);
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          selfIntersectionConfig: {
                            ...baseTransformConfig.selfIntersectionConfig,
                            maxPolygons: Number.isFinite(maxPolygons)
                              ? maxPolygons
                              : baseTransformConfig.selfIntersectionConfig.maxPolygons,
                          },
                        },
                      });
                    }}
                    disabled={disabled}
                  />
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={baseTransformConfig.selfIntersectionConfig.retainHoles}
                        onChange={(event) => {
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              selfIntersectionConfig: {
                                ...baseTransformConfig.selfIntersectionConfig,
                                retainHoles: event.target.checked,
                              },
                            },
                          });
                        }}
                        disabled={disabled}
                      />
                    )}
                    label={t('processing.filter.selfIntersectionRetainHoles', 'Retain holes')}
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.filter.selfIntersectionSnapToleranceMultiplier', 'Snap tolerance multiplier')}
                    value={baseTransformConfig.selfIntersectionConfig.snapToleranceMultiplier}
                    onChange={(event) => {
                      const snapToleranceMultiplier = Number(event.target.value);
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          selfIntersectionConfig: {
                            ...baseTransformConfig.selfIntersectionConfig,
                            snapToleranceMultiplier: Number.isFinite(snapToleranceMultiplier)
                              ? snapToleranceMultiplier
                              : baseTransformConfig.selfIntersectionConfig.snapToleranceMultiplier,
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
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {t('processing.filter.ringFixTitle', 'Ring fix settings')}
                  </Typography>
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
                  <TextField
                    fullWidth
                    type="number"
                    label={t('processing.filter.ringFixMinRingAreaMultiplier', 'Min ring area multiplier')}
                    value={baseTransformConfig.ringFixConfig.minRingAreaMultiplier}
                    onChange={(event) => {
                      const minRingAreaMultiplier = Number(event.target.value);
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          ringFixConfig: {
                            ...baseTransformConfig.ringFixConfig,
                            minRingAreaMultiplier: Number.isFinite(minRingAreaMultiplier)
                              ? minRingAreaMultiplier
                              : baseTransformConfig.ringFixConfig.minRingAreaMultiplier,
                          },
                        },
                      });
                    }}
                    disabled={disabled}
                  />
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={baseTransformConfig.ringFixConfig.removeDuplicateConsecutivePoints}
                        onChange={(event) => {
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              ringFixConfig: {
                                ...baseTransformConfig.ringFixConfig,
                                removeDuplicateConsecutivePoints: event.target.checked,
                              },
                            },
                          });
                        }}
                        disabled={disabled}
                      />
                    )}
                    label={t('processing.filter.ringFixRemoveDuplicatePoints', 'Remove duplicate points')}
                  />
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={baseTransformConfig.ringFixConfig.removeCollinearPoints}
                        onChange={(event) => {
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              ringFixConfig: {
                                ...baseTransformConfig.ringFixConfig,
                                removeCollinearPoints: event.target.checked,
                              },
                            },
                          });
                        }}
                        disabled={disabled}
                      />
                    )}
                    label={t('processing.filter.ringFixRemoveCollinearPoints', 'Remove collinear points')}
                  />
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {t('processing.filter.transformModeTitle', 'Transform mode')}
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={transformModeValue}
                    onChange={(_, value) => {
                      if (!value) return;
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          transformMode: value,
                        },
                      });
                    }}
                    disabled={disabled}
                  >
                    <ToggleButton value="full">
                      {t('processing.filter.transformModeFull', 'Full')}
                    </ToggleButton>
                    <ToggleButton value="simplify-only">
                      {t('processing.filter.transformModeSimplifyOnly', 'Simplify only')}
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <TextField
                    fullWidth
                    type="number"
                    label={t(
                      'processing.filter.boundaryDisableAtZoomOrAbove',
                      'Disable boundary handling at zoom or above',
                    )}
                    value={baseTransformConfig.boundaryDisableAtZoomOrAbove ?? ''}
                    onChange={(event) => {
                      const rawValue = event.target.value;
                      const boundaryDisableAtZoomOrAbove = rawValue === ''
                        ? undefined
                        : Number(rawValue);
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          boundaryDisableAtZoomOrAbove: Number.isFinite(boundaryDisableAtZoomOrAbove ?? 0)
                            ? boundaryDisableAtZoomOrAbove
                            : baseTransformConfig.boundaryDisableAtZoomOrAbove,
                        },
                      });
                    }}
                    helperText={t(
                      'processing.filter.boundaryDisableAtZoomOrAboveHelp',
                      'Stops boundary preservation above this zoom.',
                    )}
                    disabled={disabled}
                  />
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={baseTransformConfig.deleteOnComplete}
                        onChange={(event) => {
                          update({
                            transformConfig: {
                              ...baseTransformConfig,
                              deleteOnComplete: event.target.checked,
                            },
                          });
                        }}
                        disabled={disabled}
                      />
                    )}
                    label={t(
                      'processing.filter.deleteOnComplete',
                      'Delete simplified cache after VT completion',
                    )}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      'processing.filter.deleteOnCompleteHelp',
                      'Removes transform-stage simplified cache once VT generation completes.',
                    )}
                  </Typography>
                </Stack>
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
