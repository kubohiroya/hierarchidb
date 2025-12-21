import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Typography,
  Slider,
  Switch,
  FormGroup,
  FormHelperText,
  Paper,
  Rating,
} from '@mui/material';
import { FilterAlt as FilterAltIcon, ExpandMore as ExpandMoreIcon, FilterAlt, Filter } from '@mui/icons-material';
import type { FeatureFilterMethod, HybridFilterConfig, ProcessingConfig, SimplificationProcessingConfig } from '../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../common/types/index.js';
import { useId } from 'react';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';

type Props = {
  config: ProcessingConfig;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const SimplificationConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const { t } = useTranslation();
  const controlId = useId();
  const baseSimplificationConfig: SimplificationProcessingConfig | undefined =
    config.simplificationConfig ?? DEFAULT_PROCESSING_CONFIG.simplificationConfig;
  const defaultHybridConfig: HybridFilterConfig =
    DEFAULT_PROCESSING_CONFIG.simplificationConfig?.hybridFilterConfig ?? {
      quickRejectThreshold: 0.1,
      regularShapeMinRatio: 0.5,
      regularShapeMaxRatio: 2.0,
      simpleShapeVertexThreshold: 50,
      elongatedShapeCorrectionFactor: 0.8,
    };
  if (!baseSimplificationConfig) {
    throw new Error('SimplificationConfigSection: baseSimplificationConfig is not defined');
  }
  const baseHybridConfig: HybridFilterConfig = baseSimplificationConfig.hybridFilterConfig ?? defaultHybridConfig;
  const quickRejectMin = 0.01;
  const quickRejectMax = 1;
  const quickRejectValue = Math.min(
    Math.max(baseHybridConfig?.quickRejectThreshold ?? 0.1, quickRejectMin),
    quickRejectMax,
  );
  const quickRejectLogMin = Math.log10(quickRejectMin);
  const quickRejectLogMax = Math.log10(quickRejectMax);
  const quickRejectLogValue = Math.log10(quickRejectValue);
  const quantizeOptions = [100, 300, 1000, 3000, 10000];
  const resolveQuantizeIndex = (value: number) => {
    const resolved = quantizeOptions.reduce((best, option, index) => {
      const diff = Math.abs(option - value);
      if (!best || diff < best.diff) return { index, diff };
      return best;
    }, null as null | { index: number; diff: number });
    return resolved?.index ?? 0;
  };
  const quantizeValue = baseSimplificationConfig.quantize ?? 10000;
  const quantizeIndex = resolveQuantizeIndex(quantizeValue);
  const quantizeRank = quantizeIndex + 1;

  const update = (partial: Partial<ProcessingConfig>) => {
    onChange(mergeProcessingConfig({ ...config, ...partial }));
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.filter.title', 'Extraction Setting')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <WorkerNumberConfigCard
                icon={<FilterAlt fontSize="small" color="primary" />}
                title={t('processing.filter.workersStage1', 'Number of Workers for Polygon-Simplification (Stage 1)')}
                value={baseSimplificationConfig.level1Workers ?? 2}
                helperText={t('processing.filter.workersStage1Help', 'Parallel workers for feature simplification in stage 1.')}
                onChange={(level1Workers) =>
                  update({
                    simplificationConfig: {
                      ...baseSimplificationConfig,
                      level1Workers,
                    },
                  })
                }
                min={1}
                max={8}
                step={1}
                disabled={disabled}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <WorkerNumberConfigCard
                icon={<Filter fontSize="small" color="primary" />}
                title={t('processing.filter.workersStage2', 'Number of Workers for Tile Generation (Stage 2)')}
                value={baseSimplificationConfig.level2Workers ?? 2}
                helperText={t('processing.filter.workersStage2Help', 'Parallel workers for tile preparation in stage 2.')}
                onChange={(level2Workers) =>
                  update({
                    simplificationConfig: {
                      ...baseSimplificationConfig,
                      level2Workers,
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
                    {t('processing.filter.areaFilterTitle', 'Area Filter')}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Stack spacing={2}>
                        <FormControl component="fieldset">
                          <FormLabel component="legend" id={`${controlId}-filtering-method`}>
                            {t('processing.filter.method', 'Filtering Method')}
                          </FormLabel>
                          <RadioGroup
                            aria-labelledby={`${controlId}-filtering-method`}
                            name="filtering-method"
                            value={baseSimplificationConfig.featureFilterMethod || 'hybrid'}
                            onChange={(e) => {
                              const method = e.target.value as FeatureFilterMethod;
                              update({
                                simplificationConfig: {
                                  ...baseSimplificationConfig,
                                  featureFilterMethod: method,
                                },
                              });
                            }}
                          >
                            <FormControlLabel
                              value="bbox_only"
                              control={<Radio inputProps={{ id: `${controlId}-filtering-bbox-only`, name: 'filtering-method' }} />}
                              label={t('processing.filter.methodBBox', 'Bounding Box Only (Fastest)')}
                              disabled={disabled}
                              htmlFor={`${controlId}-filtering-bbox-only`}
                            />
                            <FormControlLabel
                              value="polygon_only"
                              control={<Radio inputProps={{ id: `${controlId}-filtering-polygon-only`, name: 'filtering-method' }} />}
                              label={t('processing.filter.methodPolygon', 'Polygon Only')}
                              disabled={disabled}
                              htmlFor={`${controlId}-filtering-polygon-only`}
                            />
                            <FormControlLabel
                              value="hybrid"
                              control={<Radio inputProps={{ id: `${controlId}-filtering-hybrid`, name: 'filtering-method' }} />}
                              label={t('processing.filter.methodHybrid', 'Hybrid (Recommended)')}
                              disabled={disabled}
                              htmlFor={`${controlId}-filtering-hybrid`}
                            />
                          </RadioGroup>
                          <FormHelperText>
                            {t('processing.filter.methodHelp', 'Controls how features are filtered before simplification.')}
                          </FormHelperText>
                        </FormControl>
                        <div>
                          <Typography gutterBottom>
                            {t('processing.filter.minVertexCount', 'Min Vertex Count')}
                          </Typography>
                          <Box sx={{ px: 2 }}>
                            <Slider
                              value={baseSimplificationConfig.minVertexCountForAreaFilter ?? 25}
                              onChange={(_, value) => {
                                const minVertexCountForAreaFilter = value as number;
                                update({
                                  simplificationConfig: {
                                    ...baseSimplificationConfig,
                                    minVertexCountForAreaFilter,
                                  },
                                });
                              }}
                              min={0}
                              max={200}
                              step={1}
                              valueLabelDisplay="auto"
                              marks={[
                                { value: 0, label: '0' },
                                { value: 25, label: '25' },
                                { value: 100, label: '100' },
                                { value: 200, label: '200' },
                              ]}
                              track="inverted"
                              disabled={disabled}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('processing.filter.minVertexCountHelp', 'Only apply area filtering when feature vertices exceed this count.')}
                          </Typography>
                        </div>
                        <div>
                          <Typography gutterBottom>
                            {t('processing.filter.minimumArea', 'Minimum Area (sq km)')}
                          </Typography>
                          <Box sx={{ px: 2 }}>
                            <Slider
                              value={baseSimplificationConfig.areaThreshold ?? 5}
                              onChange={(_, value) => {
                                const areaThreshold = value as number;
                                update({
                                  simplificationConfig: {
                                    ...baseSimplificationConfig,
                                    areaThreshold,
                                  },
                                });
                              }}
                              min={1}
                              max={100}
                              step={1}
                              valueLabelDisplay="auto"
                              marks={[{ value: 1, label: '1' }, { value: 50, label: '50' }, { value: 100, label: '100' }]}
                              track="inverted"
                              disabled={disabled}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('processing.filter.minimumAreaHelp', 'Smaller features than this threshold are filtered out early.')}
                          </Typography>
                        </div>
                      </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Stack spacing={2}>
                        <div>
                          <Typography gutterBottom>
                            {t('processing.filter.quickRejectThreshold', 'Quick Reject Threshold')}
                          </Typography>
                          <Box sx={{ px: 2 }}>
                            <Slider
                              value={quickRejectLogValue}
                              onChange={(_, value) => {
                                const logValue = value as number;
                                const quickRejectThreshold = Number((10 ** logValue).toFixed(3));
                                update({
                                  simplificationConfig: {
                                    ...baseSimplificationConfig,
                                    hybridFilterConfig: {
                                      ...baseHybridConfig,
                                      quickRejectThreshold,
                                    },
                                  },
                                });
                              }}
                              min={quickRejectLogMin}
                              max={quickRejectLogMax}
                              step={0.1}
                              valueLabelDisplay="auto"
                              valueLabelFormat={(value) => (10 ** Number(value)).toFixed(3)}
                              marks={[
                                { value: Math.log10(0.01), label: '0.01' },
                                { value: Math.log10(0.1), label: '0.1' },
                                { value: Math.log10(1), label: '1' },
                              ]}
                              track="inverted"
                              disabled={disabled || !baseHybridConfig}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('processing.filter.quickRejectHelp', 'Lower values reject more tiny features quickly.')}
                          </Typography>
                        </div>
                        <div>
                          <Typography gutterBottom>
                            {t('processing.filter.simpleShapeVertexThreshold', 'Simple Shape Vertex Threshold')}
                          </Typography>
                          <Box sx={{ px: 2 }}>
                            <Slider
                              value={baseHybridConfig?.simpleShapeVertexThreshold ?? 50}
                              onChange={(_, value) => {
                                const simpleShapeVertexThreshold = value as number;
                                update({
                                  simplificationConfig: {
                                    ...baseSimplificationConfig,
                                    hybridFilterConfig: {
                                      ...baseHybridConfig,
                                      simpleShapeVertexThreshold,
                                    },
                                  },
                                });
                              }}
                              min={0}
                              max={200}
                              step={1}
                              valueLabelDisplay="auto"
                              marks={[
                                { value: 0, label: '0' },
                                { value: 50, label: '50' },
                                { value: 100, label: '100' },
                                { value: 200, label: '200' },
                              ]}
                              disabled={disabled || !baseHybridConfig}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('processing.filter.simpleShapeVertexHelp', 'Vertex count threshold for simple-shape handling.')}
                          </Typography>
                        </div>
                        <div>
                          <Typography gutterBottom>
                            {t('processing.filter.elongatedShapeCorrectionFactor', 'Elongated Shape Correction Factor')}
                          </Typography>
                          <Box sx={{ px: 2 }}>
                            <Slider
                              value={baseHybridConfig?.elongatedShapeCorrectionFactor ?? 0.8}
                              onChange={(_, value) => {
                                const elongatedShapeCorrectionFactor = value as number;
                                update({
                                  simplificationConfig: {
                                    ...baseSimplificationConfig,
                                    hybridFilterConfig: {
                                      ...baseHybridConfig,
                                      elongatedShapeCorrectionFactor,
                                    },
                                  },
                                });
                              }}
                              min={0.5}
                              max={1.5}
                              step={0.05}
                              valueLabelDisplay="auto"
                              marks={[
                                { value: 0.5, label: '0.5' },
                                { value: 1, label: '1.0' },
                                { value: 1.5, label: '1.5' },
                              ]}
                              disabled={disabled || !baseHybridConfig}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('processing.filter.elongatedShapeHelp', 'Correction factor for elongated simple shapes.')}
                          </Typography>
                        </div>
                      </Stack>
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={3}>
                <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                  <Stack spacing={2}>
                    <Typography variant="subtitle2">
                      {t('processing.filter.simplificationTitle', 'Simplification')}
                    </Typography>
                    <div>
                      <Typography gutterBottom>
                        {t('processing.filter.tolerance', 'Simplification Tolerance (degrees)')}
                      </Typography>
                      <Box sx={{ px: 2 }}>
                        <Slider
                          value={baseSimplificationConfig.tolerance ?? 0.01}
                          onChange={(_, value) => {
                            const tolerance = value as number;
                            update({
                              simplificationConfig: {
                                ...baseSimplificationConfig,
                                tolerance,
                              },
                            });
                          }}
                          min={0.001}
                          max={0.1}
                          step={0.001}
                          marks={[
                            { value: 0.001, label: '0.001' },
                            { value: 0.1, label: '0.1' },
                          ]}
                          valueLabelDisplay="auto"
                          track="inverted"
                          disabled={disabled}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {t('processing.filter.toleranceHelp', 'Higher values simplify geometry more aggressively.')}
                      </Typography>
                    </div>
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(baseSimplificationConfig.enablePerFeatureSimplification)}
                            onChange={(event) => {
                              update({
                                simplificationConfig: {
                                  ...baseSimplificationConfig,
                                  enablePerFeatureSimplification: event.target.checked,
                                },
                              });
                            }}
                            disabled={disabled}
                          />
                        }
                        label={t('processing.filter.enablePerFeatureSimplification', 'Enable per-feature simplification')}
                      />
                      <FormHelperText>
                        {t('processing.filter.enablePerFeatureSimplificationHelp', 'Apply tolerance per feature instead of globally.')}
                      </FormHelperText>
                    </FormGroup>
                  </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                  <Stack spacing={2}>
                    <Typography variant="subtitle2">
                      {t('processing.filter.precisionTitle', 'Precision & Compression')}
                    </Typography>
                    <div>
                      <Typography gutterBottom>
                        {t('processing.filter.quantize', 'Coordinate Quantization')}
                      </Typography>
                      <Rating
                        value={quantizeRank}
                        max={quantizeOptions.length}
                        onChange={(_, value) => {
                          const index = Math.max(0, (value ?? 1) - 1);
                          const quantize = quantizeOptions[index];
                          update({
                            simplificationConfig: {
                              ...baseSimplificationConfig,
                              quantize,
                            },
                          });
                        }}
                        disabled={disabled}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {t('processing.filter.quantizeSelected', 'Selected: {value}', { value: quantizeOptions[quantizeIndex]?.toLocaleString() })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('processing.filter.quantizeHelp', 'Quantization factor used in simplify stage 2.')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('processing.filter.quantizeStarHelp', '★1 is the coarsest rounding (lowest precision); higher stars increase precision.')}
                      </Typography>
                    </div>
                  </Stack>
                </Paper>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
