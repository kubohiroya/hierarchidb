/**
 * @file StylerConfiguration.tsx
 * @description Styler configuration UI component (Step 5)
 * : UI
 * : eria-cartographHierarchiDB UI
 * : MUIUI
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
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  ColorAlgorithm,
  ColorSpace,
  MapLibreStyleProperty,
  StylerConfig,
} from '../../../common/types/stylerTypes.js';
import {
  MAPLIBRE_PROPERTY_GROUPS,
  MAPLIBRE_PROPERTY_METADATA,
  StylerConfigDefault,
} from '../../../common/types/stylerTypes.js';
import { generateColorGradient } from '../../../common/utils/colorUtils.js';
import {
  analyzeData,
  type DataAnalysisResult,
  extractNumericValues,
} from '../../../common/utils/dataAnalysis.js';

/**
 * : StylerConfiguration
 */
export interface StylerConfigurationProps {
  config?: StylerConfig;
  onChange: (config: StylerConfig) => void;
  values?: number[];
  columns?: string[];
  selectedKeyColumn?: string;
  selectedValueColumn?: string;
  onColumnSelect?: (column: string, type: 'key' | 'value') => void;
  csvData?: Array<Record<string, any>>; //  CSV
}

/**
 * : StylerUI
 * : eria-cartographHierarchiDBMUI
 * :
 * : UI
 */
export const StylerConfiguration: React.FC<StylerConfigurationProps> = ({
  config = StylerConfigDefault,
  onChange,
  values = [],
  columns = [],
  selectedKeyColumn,
  selectedValueColumn,
  onColumnSelect,
  csvData = [],
}) => {
  const [localConfig, setLocalConfig] = useState<StylerConfig>(() => {
    // Initialize with sample values if available
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
    if (selectedValueColumn && csvData.length > 0) {
      setIsAnalyzing(true);

      const analyzeAsync = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 300));

          const numericValues = extractNumericValues(csvData, selectedValueColumn);
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
  }, [selectedValueColumn, csvData]);

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
      if (newAlgorithm) {
        const newConfig = { ...localConfig, algorithm: newAlgorithm };
        setLocalConfig(newConfig);
        onChange(newConfig);
      }
    },
    [localConfig, onChange]
  );

  const handleColorSpaceChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newColorSpace: ColorSpace | null) => {
      if (newColorSpace) {
        const newConfig = { ...localConfig, colorSpace: newColorSpace };
        setLocalConfig(newConfig);
        onChange(newConfig);
      }
    },
    [localConfig, onChange]
  );

  const handleMappingChange = useCallback(
    (field: keyof StylerConfig['mapping'], value: number | number[]) => {
      const numValue = Array.isArray(value) ? value[0] : value;
      const newConfig = {
        ...localConfig,
        mapping: {
          ...localConfig.mapping,
          [field]: numValue,
        },
      };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const handleTargetPropertyChange = useCallback(
    (event: any) => {
      const targetProperty = event.target.value as MapLibreStyleProperty;
      const newConfig = { ...localConfig, targetProperty };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const handleKeyColumnChange = useCallback(
    (event: any) => {
      const column = event.target.value;
      if (onColumnSelect) {
        onColumnSelect(column, 'key');
      }
    },
    [onColumnSelect]
  );

  const handleValueColumnChange = useCallback(
    (event: any) => {
      const column = event.target.value;
      if (onColumnSelect) {
        onColumnSelect(column, 'value');
      }
    },
    [onColumnSelect]
  );

  const gradientPreview = useMemo(() => {
    return generateColorGradient(localConfig);
  }, [localConfig]);

  const targetMetadata = localConfig.targetProperty
    ? MAPLIBRE_PROPERTY_METADATA[localConfig.targetProperty]
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Step Title */}
      <Typography variant="h6" gutterBottom>
        Step 5: Style Mapping Configuration
      </Typography>

      {/* Column Selection */}
      {columns.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Data Column Selection
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
              },
            }}
          >
            <FormControl fullWidth size="small" sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
              <InputLabel>Key Column</InputLabel>
              <Select
                value={selectedKeyColumn || ''}
                onChange={handleKeyColumnChange}
                label="Key Column"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {columns.map((col) => (
                  <MenuItem key={col} value={col}>
                    {col}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Column to use as feature identifier</FormHelperText>
            </FormControl>

            <FormControl fullWidth size="small" sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
              <InputLabel>Value Column</InputLabel>
              <Select
                value={selectedValueColumn || ''}
                onChange={handleValueColumnChange}
                label="Value Column"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {columns
                  .filter((col) => col !== selectedKeyColumn)
                  .map((col) => (
                    <MenuItem key={col} value={col}>
                      {col}
                    </MenuItem>
                  ))}
              </Select>
              <FormHelperText>Column containing values to map</FormHelperText>
            </FormControl>
          </Box>
        </Paper>
      )}

      {/* Target Property Selection */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          MapLibre Style Property
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Target Property</InputLabel>
          <Select
            value={localConfig.targetProperty || ''}
            onChange={handleTargetPropertyChange}
            label="Target Property"
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {MAPLIBRE_PROPERTY_GROUPS.map((group) => (
              <React.Fragment key={group.name}>
                <MenuItem disabled>
                  <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                    {group.displayName}
                  </Typography>
                </MenuItem>
                {group.properties.map((prop) => (
                  <MenuItem key={prop} value={prop} sx={{ pl: 3 }}>
                    {MAPLIBRE_PROPERTY_METADATA[prop].displayName}
                  </MenuItem>
                ))}
              </React.Fragment>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* Color Configuration */}
      {localConfig.targetProperty && targetMetadata?.type === 'color' && (
        <>
          {/*
           */}
          {dataAnalysis && showRecommendation && (
            <Collapse in={showRecommendation}>
              <Paper sx={{ p: 2, bgcolor: 'info.lighter', border: 1, borderColor: 'info.main' }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AutoFixHighIcon color="info" />
                    <Typography variant="subtitle2" color="info.main">
                      {tStr('step5.recommendation.title', 'Algorithm Recommendation')}
                    </Typography>
                  </Stack>

                  <Alert
                    severity="info"
                    onClose={() => setShowRecommendation(false)}
                    action={
                      <Button
                        size="small"
                        variant="contained"
                        onClick={applyRecommendation}
                        disabled={isAnalyzing}
                        startIcon={isAnalyzing ? <CircularProgress size={16} /> : null}
                      >
                        {tStr('step5.recommendation.apply', 'Apply')}
                      </Button>
                    }
                  >
                    <AlertTitle>{recommendationTitle}</AlertTitle>
                    {recommendation?.reasoning}
                    {recommendationConfidence && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        {recommendationConfidence}
                      </Typography>
                    )}
                  </Alert>
                </Stack>
              </Paper>
            </Collapse>
          )}

          {/*
 Algorithm Selection
*/}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {tStr('step5.algorithmSection.title', 'Color Classification Algorithms')}
            </Typography>
            <ToggleButtonGroup
              value={localConfig.algorithm}
              exclusive
              onChange={handleAlgorithmChange}
              size="small"
              fullWidth
            >
              <ToggleButton value="linear">
                <Stack alignItems="center" spacing={0.5}>
                  <ShowChartIcon fontSize="small" />
                  <Typography variant="caption">{algorithmLabels.linear}</Typography>
                  {recommendation && (
                    <Chip
                      label={`${recommendation.suitability.linear}%`}
                      size="small"
                      color={
                        recommendation.suitability.linear > 70
                          ? 'success'
                          : recommendation.suitability.linear > 40
                            ? 'default'
                            : 'error'
                      }
                      sx={{ height: 16, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>
              </ToggleButton>

              <ToggleButton value="quantile">
                <Stack alignItems="center" spacing={0.5}>
                  <BarChartIcon fontSize="small" />
                  <Typography variant="caption">{algorithmLabels.quantile}</Typography>
                  {recommendation && (
                    <Chip
                      label={`${recommendation.suitability.quantile}%`}
                      size="small"
                      color={
                        recommendation.suitability.quantile > 70
                          ? 'success'
                          : recommendation.suitability.quantile > 40
                            ? 'default'
                            : 'error'
                      }
                      sx={{ height: 16, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>
              </ToggleButton>

              <ToggleButton value="jenks">
                <Stack alignItems="center" spacing={0.5}>
                  <InsightsIcon fontSize="small" />
                  <Typography variant="caption">{algorithmLabels.jenks}</Typography>
                  {recommendation && (
                    <Chip
                      label={`${recommendation.suitability.jenks}%`}
                      size="small"
                      color={
                        recommendation.suitability.jenks > 70
                          ? 'success'
                          : recommendation.suitability.jenks > 40
                            ? 'default'
                            : 'error'
                      }
                      sx={{ height: 16, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>
              </ToggleButton>

              <ToggleButton value="equal">
                <Stack alignItems="center" spacing={0.5}>
                  <ViewColumnIcon fontSize="small" />
                  <Typography variant="caption">{algorithmLabels.equal}</Typography>
                  {recommendation && (
                    <Chip
                      label={`${recommendation.suitability.equal}%`}
                      size="small"
                      color={
                        recommendation.suitability.equal > 70
                          ? 'success'
                          : recommendation.suitability.equal > 40
                            ? 'default'
                            : 'error'
                      }
                      sx={{ height: 16, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>

            {/*
             */}
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <InfoIcon fontSize="small" color="action" sx={{ mt: 0.5 }} />
                <Box>
                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    {algorithmLabels[localConfig.algorithm] || localConfig.algorithm}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {algorithmDescriptions[localConfig.algorithm]}
                  </Typography>

                  {/*
                   */}
                  {currentSuitability !== null && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="primary">
                        {formatTemplate(
                          tStr(
                            'step5.recommendation.suitability',
                            'Suitability for your data: {value}%'
                          ),
                          { value: currentSuitability }
                        )}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Stack>
            </Box>
          </Paper>

          {/* Color Space Selection */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Color Space
            </Typography>
            <ToggleButtonGroup
              value={localConfig.colorSpace}
              exclusive
              onChange={handleColorSpaceChange}
              size="small"
              fullWidth
            >
              <ToggleButton value="hsv">
                <Stack direction="row" spacing={1} alignItems="center">
                  <PaletteIcon fontSize="small" />
                  <span>HSV</span>
                </Stack>
              </ToggleButton>
              <ToggleButton value="rgb">
                <Stack direction="row" spacing={1} alignItems="center">
                  <GradientIcon fontSize="small" />
                  <span>RGB</span>
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
          </Paper>

          {/* Value Range Configuration */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Value Range
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                },
              }}
            >
              <TextField
                label="Min Value"
                type="number"
                value={localConfig.mapping.min}
                onChange={(e) => handleMappingChange('min', parseFloat(e.target.value) || 0)}
                size="small"
                fullWidth
                sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
              />
              <TextField
                label="Max Value"
                type="number"
                value={localConfig.mapping.max}
                onChange={(e) => handleMappingChange('max', parseFloat(e.target.value) || 100)}
                size="small"
                fullWidth
                sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
              />
            </Box>
          </Paper>

          {/* HSV Configuration */}
          {localConfig.colorSpace === 'hsv' && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                HSV Color Configuration
              </Typography>

              {/* Hue Range */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">Hue Range</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="caption" sx={{ minWidth: 40 }}>
                    {localConfig.mapping.hueStart}°
                  </Typography>
                  <Slider
                    value={[localConfig.mapping.hueStart, localConfig.mapping.hueEnd]}
                    onChange={(_e, value) => {
                      if (Array.isArray(value) && value.length >= 2) {
                        handleMappingChange('hueStart', value[0] ?? 0);
                        handleMappingChange('hueEnd', value[1] ?? 360);
                      }
                    }}
                    valueLabelDisplay="auto"
                    min={0}
                    max={360}
                    marks={[
                      { value: 0, label: '0°' },
                      { value: 360, label: '360°' },
                    ]}
                  />
                  <Typography variant="caption" sx={{ minWidth: 40 }}>
                    {localConfig.mapping.hueEnd}°
                  </Typography>
                </Stack>
              </Box>

              {/* Saturation */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">Saturation</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="caption" sx={{ minWidth: 40 }}>
                    {Math.round(localConfig.mapping.saturation * 100)}%
                  </Typography>
                  <Slider
                    value={localConfig.mapping.saturation}
                    onChange={(_e, value) => handleMappingChange('saturation', value as number)}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                    min={0}
                    max={1}
                    step={0.01}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 1, label: '100%' },
                    ]}
                  />
                </Stack>
              </Box>

              {/* Brightness */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">Brightness</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="caption" sx={{ minWidth: 40 }}>
                    {Math.round(localConfig.mapping.brightness * 100)}%
                  </Typography>
                  <Slider
                    value={localConfig.mapping.brightness}
                    onChange={(_e, value) => handleMappingChange('brightness', value as number)}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                    min={0}
                    max={1}
                    step={0.01}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 1, label: '100%' },
                    ]}
                  />
                </Stack>
              </Box>
            </Paper>
          )}

          {/* Color Preview */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Color Scale Preview
            </Typography>
            <Box
              sx={{
                height: 40,
                background: gradientPreview,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
              <Typography variant="caption">{localConfig.mapping.min}</Typography>
              <Typography variant="caption">{localConfig.mapping.max}</Typography>
            </Stack>
          </Paper>
        </>
      )}
    </Box>
  );
};
