/**
 * @file StylerMapping.tsx
 * @description Styler mapping configuration UI component (Step 5)
 */

import {
  AutoFixHigh as AutoFixHighIcon,
  BarChart as BarChartIcon,
  Gradient as GradientIcon,
  Info as InfoIcon,
  Insights as InsightsIcon,
  Palette as PaletteIcon,
  ShowChart as ShowChartIcon,
  ViewColumn as ViewColumnIcon,
} from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Paper,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColorAlgorithm, ColorSpace, StylerConfig, StylerTableRow } from '../../../common/types/stylerTypes.js';
import { StylerConfigDefault } from '../../../common/types/stylerTypes.js';
import { generateColorGradient } from '../../../common/utils/colorUtils.js';
import {
  analyzeData,
  type DataAnalysisResult,
  extractNumericValues,
} from '../../../common/utils/dataAnalysis.js';

export interface StylerMappingProps {
  config?: StylerConfig;
  onChange: (config: StylerConfig) => void;
  values?: number[];
  selectedValueColumn?: string;
  tabularData?: StylerTableRow[];
}

export const StylerMapping: React.FC<StylerMappingProps> = ({
  config = StylerConfigDefault,
  onChange,
  values = [],
  selectedValueColumn,
  tabularData = [],
}) => {
  const [localConfig, setLocalConfig] = useState<StylerConfig>(() => {
    if (values.length > 0) {
      const numericValues = values.filter((v) => !Number.isNaN(v));

      if (numericValues.length > 0) {
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        return {
          ...config,
          mapping: {
            ...config.mapping,
            min,
            max,
          },
        };
      }
    }
    return config;
  });

  const [dataAnalysis, setDataAnalysis] = useState<DataAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const controlId = useId();

  const { t } = useTranslation('styler-plugin');
  const tStr = useCallback(
    (key: string, defaultValue: string) => {
      const result = t(key, { defaultValue });
      return typeof result === 'string' ? result : defaultValue;
    },
    [t]
  );

  const formatTemplate = useCallback(
    (template: string, values: Record<string, string | number>) => {
      return Object.entries(values).reduce(
        (acc, [key, value]) => acc.replace(new RegExp(`{${key}}`, 'g'), String(value)),
        template
      );
    },
    []
  );

  const algorithmLabels = useMemo(
    () =>
      ({
        linear: tStr('step5.algorithms.linear', 'Linear'),
        quantile: tStr('step5.algorithms.quantile', 'Quantile'),
        jenks: tStr('step5.algorithms.jenks', 'Jenks Natural Breaks'),
        equal: tStr('step5.algorithms.equal', 'Equal Interval'),
      }) as Record<ColorAlgorithm, string>,
    [tStr]
  );

  const algorithmDescriptions = useMemo(
    () =>
      ({
        linear: tStr(
          'step5.algorithms.linearDescription',
          'Interpolates colors smoothly between minimum and maximum values. Ideal for evenly distributed data or when visualizing continuous transitions.'
        ),
        quantile: tStr(
          'step5.algorithms.quantileDescription',
          'Creates classes with an equal number of features. Produces balanced visuals even for skewed data and is resilient to outliers.'
        ),
        jenks: tStr(
          'step5.algorithms.jenksDescription',
          'Finds natural breaks by minimizing variance within classes and maximizing it between classes. Offers meaningful groupings at a higher computational cost.'
        ),
        equal: tStr(
          'step5.algorithms.equalDescription',
          'Divides the value range into equal intervals. Suited for continuous, roughly linear distributions such as temperature or elevation, and is fast and easy to understand.'
        ),
      }) as Record<ColorAlgorithm, string>,
    [tStr]
  );

  const recommendation = dataAnalysis?.recommendation || null;
  const recommendationTitle = recommendation
    ? formatTemplate(tStr('step5.recommendation.summary', 'Recommended algorithm: {algorithm}'), {
        algorithm: algorithmLabels[recommendation.algorithm] || recommendation.algorithm,
      })
    : '';
  const recommendationConfidence = recommendation
    ? formatTemplate(tStr('step5.recommendation.confidence', 'Confidence: {confidence}%'), {
        confidence: Math.round(recommendation.confidence * 100),
      })
    : '';
  const currentSuitability = recommendation
    ? recommendation.suitability[localConfig.algorithm]
    : null;

  useEffect(() => {
    if (selectedValueColumn && tabularData.length > 0) {
      setIsAnalyzing(true);

      const analyzeAsync = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 300));

          const numericValues = extractNumericValues(tabularData, selectedValueColumn);
          if (numericValues.length > 0) {
            const analysis = analyzeData(numericValues, selectedValueColumn);
            setDataAnalysis(analysis);
          }
        } finally {
          setIsAnalyzing(false);
        }
      };

      analyzeAsync();
    }
  }, [selectedValueColumn, tabularData]);

  const applyRecommendation = useCallback(() => {
    if (dataAnalysis?.recommendation) {
      const newConfig = {
        ...localConfig,
        algorithm: dataAnalysis.recommendation.algorithm,
      };
      setLocalConfig(newConfig);
      onChange(newConfig);
      setShowRecommendation(false);
    }
  }, [dataAnalysis, localConfig, onChange]);

  const handleAlgorithmChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newAlgorithm: ColorAlgorithm | null) => {
      if (!newAlgorithm) return;
      const newConfig = { ...localConfig, algorithm: newAlgorithm };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const handleColorSpaceChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newColorSpace: ColorSpace | null) => {
      if (!newColorSpace) return;
      const newConfig = { ...localConfig, colorSpace: newColorSpace };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const handleMappingChange =
    (field: keyof StylerConfig['mapping']) => (_event: Event, value: number | number[]) => {
      const newConfig = {
        ...localConfig,
        mapping: {
          ...localConfig.mapping,
          [field]: value as number,
        },
      };
      setLocalConfig(newConfig);
      onChange(newConfig);
    };

  const handleInvertColorsChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newValue: 'normal' | 'inverted') => {
      const inverted = newValue === 'inverted';
      const newConfig = { ...localConfig, invertColors: inverted };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const gradientPreview = useMemo(() => generateColorGradient(localConfig), [localConfig]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('step5.title', 'Step 5: Style Mapping Configuration')}
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Stack flex={1} spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('step5.mappingRange.title', 'Mapping Range')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={t('step5.mappingRange.min', 'Minimum')}
                type="number"
                value={localConfig.mapping.min}
                onChange={(e) => {
                  const min = Number(e.target.value);
                  handleMappingChange('min')({} as Event, min);
                }}
                inputProps={{
                  step: 1,
                  id: `${controlId}-mapping-min`,
                  name: 'styler-mapping-min',
                }}
              />
              <TextField
                label={t('step5.mappingRange.max', 'Maximum')}
                type="number"
                value={localConfig.mapping.max}
                onChange={(e) => {
                  const max = Number(e.target.value);
                  handleMappingChange('max')({} as Event, max);
                }}
                inputProps={{
                  step: 1,
                  id: `${controlId}-mapping-max`,
                  name: 'styler-mapping-max',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {t('step5.mappingRange.help', 'Define the numeric domain to map onto colors.')}
              </Typography>
            </Box>
          </Paper>
        </Stack>

        <Stack flex={1} spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('step5.algorithm.title', 'Color Algorithm')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              color="primary"
              value={localConfig.algorithm}
              onChange={handleAlgorithmChange}
              size="small"
            >
              <ToggleButton value="linear">
                <ShowChartIcon fontSize="small" sx={{ mr: 1 }} />
                {algorithmLabels.linear}
              </ToggleButton>
              <ToggleButton value="quantile">
                <BarChartIcon fontSize="small" sx={{ mr: 1 }} />
                {algorithmLabels.quantile}
              </ToggleButton>
              <ToggleButton value="jenks">
                <InsightsIcon fontSize="small" sx={{ mr: 1 }} />
                {algorithmLabels.jenks}
              </ToggleButton>
              <ToggleButton value="equal">
                <GradientIcon fontSize="small" sx={{ mr: 1 }} />
                {algorithmLabels.equal}
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {algorithmDescriptions[localConfig.algorithm]}
            </Typography>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">
                {t('step5.advanced.title', 'Advanced color controls')}
              </Typography>
              <Button size="small" onClick={() => setShowAdvanced((prev) => !prev)}>
                {showAdvanced ? t('step5.advanced.hide', 'Hide') : t('step5.advanced.show', 'Show')}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t(
                'step5.advanced.description',
                'Optional tweaks for color interpolation and palettes. Leave hidden for quick setups.'
              )}
            </Typography>
            <Collapse in={showAdvanced} timeout="auto" unmountOnExit>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('step5.colorSpace.title', 'Color Space')}
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    color="primary"
                    value={localConfig.colorSpace}
                    onChange={handleColorSpaceChange}
                    size="small"
                  >
                    <ToggleButton value="hsv">
                      <PaletteIcon fontSize="small" sx={{ mr: 1 }} />
                      {t('step5.colorSpace.hsv', 'HSV')}
                    </ToggleButton>
                    <ToggleButton value="rgb">
                      <ShowChartIcon fontSize="small" sx={{ mr: 1 }} />
                      {t('step5.colorSpace.rgb', 'RGB')}
                    </ToggleButton>
                    <ToggleButton value="lab">
                      <AutoFixHighIcon fontSize="small" sx={{ mr: 1 }} />
                      {t('step5.colorSpace.lab', 'LAB')}
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary">
                    {t('step5.colorSpace.help', 'Choose how colors are interpolated across the range.')}
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('step5.colorRange.title', 'Color Range & Inversion')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label={t('step5.colorRange.start', 'Start Color (hex)')}
                      value={localConfig.mapping.startColor ?? ''}
                      onChange={(e) => {
                        const newConfig = {
                          ...localConfig,
                          mapping: { ...localConfig.mapping, startColor: e.target.value },
                        };
                        setLocalConfig(newConfig);
                        onChange(newConfig);
                      }}
                      inputProps={{
                        id: `${controlId}-color-start`,
                        name: 'styler-color-start',
                      }}
                    />
                    <TextField
                      label={t('step5.colorRange.end', 'End Color (hex)')}
                      value={localConfig.mapping.endColor ?? ''}
                      onChange={(e) => {
                        const newConfig = {
                          ...localConfig,
                          mapping: { ...localConfig.mapping, endColor: e.target.value },
                        };
                        setLocalConfig(newConfig);
                        onChange(newConfig);
                      }}
                      inputProps={{
                        id: `${controlId}-color-end`,
                        name: 'styler-color-end',
                      }}
                    />

                    <ToggleButtonGroup
                      exclusive
                      value={localConfig.invertColors ? 'inverted' : 'normal'}
                      onChange={handleInvertColorsChange}
                      size="small"
                    >
                      <ToggleButton value="normal">{t('step5.colorRange.normal', 'Normal')}</ToggleButton>
                      <ToggleButton value="inverted">{t('step5.colorRange.invert', 'Invert')}</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('step5.hsv.title', 'HSV Controls')}
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
                    <Box>
                      <Typography gutterBottom>{t('step5.hsv.hueStart', 'Hue Start')}</Typography>
                      <Slider
                        value={localConfig.mapping.hueStart}
                        onChange={handleMappingChange('hueStart')}
                        min={0}
                        max={360}
                        step={1}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                    <Box>
                      <Typography gutterBottom>{t('step5.hsv.hueEnd', 'Hue End')}</Typography>
                      <Slider
                        value={localConfig.mapping.hueEnd}
                        onChange={handleMappingChange('hueEnd')}
                        min={0}
                        max={360}
                        step={1}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                    <Box>
                      <Typography gutterBottom>{t('step5.hsv.saturation', 'Saturation')}</Typography>
                      <Slider
                        value={localConfig.mapping.saturation}
                        onChange={handleMappingChange('saturation')}
                        min={0}
                        max={1}
                        step={0.05}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                    <Box>
                      <Typography gutterBottom>{t('step5.hsv.brightness', 'Brightness')}</Typography>
                      <Slider
                        value={localConfig.mapping.brightness}
                        onChange={handleMappingChange('brightness')}
                        min={0}
                        max={1}
                        step={0.05}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  </Box>
                </Paper>
              </Stack>
            </Collapse>
          </Paper>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {t('step5.gradient.title', 'Color Gradient Preview')}
        </Typography>
        <Box
          sx={{
            height: 40,
            background: gradientPreview,
            borderRadius: 1,
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {t('step5.gradient.description', 'Preview of the gradient based on current mapping and algorithm.')}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <ViewColumnIcon fontSize="small" />
          <Typography variant="subtitle2">
            {t('step5.distribution.title', 'Value Distribution (sampled)')}
          </Typography>
        </Box>

        {isAnalyzing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2">
              {t('step5.distribution.analyzing', 'Analyzing value distribution…')}
            </Typography>
          </Box>
        )}

        {dataAnalysis?.statistics && (
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip
              icon={<BarChartIcon />}
              label={t('step5.distribution.mean', 'Mean: {{value}}', {
                value: dataAnalysis.statistics.mean.toFixed(2),
              })}
              size="small"
            />
            <Chip
              icon={<BarChartIcon />}
              label={t('step5.distribution.median', 'Median: {{value}}', {
                value: dataAnalysis.statistics.median.toFixed(2),
              })}
              size="small"
            />
            <Chip
              icon={<BarChartIcon />}
              label={t('step5.distribution.stdDev', 'Std Dev: {{value}}', {
                value: dataAnalysis.statistics.stdDev.toFixed(2),
              })}
              size="small"
            />
            <Chip
              icon={<BarChartIcon />}
              label={t('step5.distribution.min', 'Min: {{value}}', {
                value: dataAnalysis.statistics.min.toFixed(2),
              })}
              size="small"
            />
            <Chip
              icon={<BarChartIcon />}
              label={t('step5.distribution.max', 'Max: {{value}}', {
                value: dataAnalysis.statistics.max.toFixed(2),
              })}
              size="small"
            />
          </Stack>
        )}

        <Collapse in={Boolean(recommendation && showRecommendation)} sx={{ mt: 2 }}>
          <Alert
            severity="info"
            icon={<InfoIcon />}
            action={
              <Button color="inherit" size="small" onClick={applyRecommendation}>
                {t('step5.recommendation.apply', 'Apply')}
              </Button>
            }
          >
            <AlertTitle>{recommendationTitle}</AlertTitle>
            <Typography variant="body2">
              {recommendationConfidence ||
                tStr(
                  'step5.recommendation.fallback',
                  'Try this algorithm to match your data distribution.'
                )}
            </Typography>
            {currentSuitability && (
              <Typography variant="caption" color="text.secondary">
                {t('step5.recommendation.suitability', 'Suitability score: {{score}} / 100', {
                  score: Math.round(currentSuitability * 100),
                })}
              </Typography>
            )}
          </Alert>
        </Collapse>
      </Paper>
    </Box>
  );
};
