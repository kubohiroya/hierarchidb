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
import type { SelectChangeEvent } from '@mui/material/Select';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  ColorAlgorithm,
  ColorSpace,
  MapLibreStyleProperty,
  StylerConfig,
  StylerTableRow,
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

export interface StylerMappingProps {
  config?: StylerConfig;
  onChange: (config: StylerConfig) => void;
  values?: number[];
  columns?: string[];
  selectedKeyColumn?: string;
  selectedValueColumn?: string;
  onColumnSelect?: (column: string, type: 'key' | 'value') => void;
  tabularData?: StylerTableRow[];
}

export const StylerMapping: React.FC<StylerMappingProps> = ({
  config = StylerConfigDefault,
  onChange,
  values = [],
  columns = [],
  selectedKeyColumn,
  selectedValueColumn,
  onColumnSelect,
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

  const handleTargetPropertyChange = useCallback(
    (event: SelectChangeEvent<MapLibreStyleProperty>) => {
      const targetProperty = event.target.value as MapLibreStyleProperty;
      const newConfig = { ...localConfig, targetProperty };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const handleKeyColumnChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const column = event.target.value;
      const newConfig = {
        ...localConfig,
        keyColumn: column,
      };
      setLocalConfig(newConfig);
      onChange(newConfig);
      if (onColumnSelect) {
        onColumnSelect(column, 'key');
      }
    },
    [localConfig, onChange, onColumnSelect]
  );

  const handleValueColumnChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const column = event.target.value;
      const newConfig = {
        ...localConfig,
        valueColumn: column,
      };
      setLocalConfig(newConfig);
      onChange(newConfig);
      if (onColumnSelect) {
        onColumnSelect(column, 'value');
      }
    },
    [localConfig, onChange, onColumnSelect]
  );

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

  const targetMetadata = localConfig.targetProperty
    ? MAPLIBRE_PROPERTY_METADATA[localConfig.targetProperty]
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        Step 5: Style Mapping Configuration
      </Typography>

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
                {columns.map((col) => (
                  <MenuItem key={col} value={col}>
                    {col}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Column whose numeric values drive styling</FormHelperText>
            </FormControl>
          </Box>
        </Paper>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Stack flex={1} spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Target Style Property
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="target-property-label">MapLibre Property</InputLabel>
              <Select
                labelId="target-property-label"
                value={localConfig.targetProperty ?? ''}
                label="MapLibre Property"
                onChange={handleTargetPropertyChange}
                renderValue={(selected) =>
                  selected ? MAPLIBRE_PROPERTY_METADATA[selected as MapLibreStyleProperty].displayName : ''
                }
              >
                {MAPLIBRE_PROPERTY_GROUPS.map((group) => (
                  <React.Fragment key={group.name}>
                    <MenuItem disabled value="">
                      <Typography variant="overline" color="text.secondary">
                        {group.displayName}
                      </Typography>
                    </MenuItem>
                    {group.properties.map((property) => (
                      <MenuItem key={property} value={property}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PaletteIcon fontSize="small" />
                          <span>{MAPLIBRE_PROPERTY_METADATA[property].displayName}</span>
                        </Box>
                      </MenuItem>
                    ))}
                  </React.Fragment>
                ))}
              </Select>
              <FormHelperText>
                Choose which MapLibre paint property to drive with your data column.
              </FormHelperText>
            </FormControl>

            {targetMetadata && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <AlertTitle>{targetMetadata.displayName}</AlertTitle>
                {tStr('step5.targetProperty.helper', 'Adjust mapping and algorithm to fit your data.')}
              </Alert>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Mapping Range
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Minimum"
                type="number"
                value={localConfig.mapping.min}
                onChange={(e) => {
                  const min = Number(e.target.value);
                  handleMappingChange('min')({} as Event, min);
                }}
                inputProps={{ step: 1 }}
              />
              <TextField
                label="Maximum"
                type="number"
                value={localConfig.mapping.max}
                onChange={(e) => {
                  const max = Number(e.target.value);
                  handleMappingChange('max')({} as Event, max);
                }}
                inputProps={{ step: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                Define the numeric domain to map onto colors.
              </Typography>
            </Box>
          </Paper>
        </Stack>

        <Stack flex={1} spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Color Algorithm
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
            <Typography variant="subtitle2" gutterBottom>
              Color Space
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
                HSV
              </ToggleButton>
              <ToggleButton value="rgb">
                <ShowChartIcon fontSize="small" sx={{ mr: 1 }} />
                RGB
              </ToggleButton>
              <ToggleButton value="lab">
                <AutoFixHighIcon fontSize="small" sx={{ mr: 1 }} />
                LAB
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">
              Choose how colors are interpolated across the range.
            </Typography>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Color Range & Inversion
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Start Color (hex)"
                value={localConfig.mapping.startColor ?? ''}
                onChange={(e) => {
                  const newConfig = {
                    ...localConfig,
                    mapping: { ...localConfig.mapping, startColor: e.target.value },
                  };
                  setLocalConfig(newConfig);
                  onChange(newConfig);
                }}
              />
              <TextField
                label="End Color (hex)"
                value={localConfig.mapping.endColor ?? ''}
                onChange={(e) => {
                  const newConfig = {
                    ...localConfig,
                    mapping: { ...localConfig.mapping, endColor: e.target.value },
                  };
                  setLocalConfig(newConfig);
                  onChange(newConfig);
                }}
              />

              <ToggleButtonGroup
                exclusive
                value={localConfig.invertColors ? 'inverted' : 'normal'}
                onChange={handleInvertColorsChange}
                size="small"
              >
                <ToggleButton value="normal">Normal</ToggleButton>
                <ToggleButton value="inverted">Invert</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              HSV Controls
            </Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
              <Box>
                <Typography gutterBottom>Hue Start</Typography>
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
                <Typography gutterBottom>Hue End</Typography>
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
                <Typography gutterBottom>Saturation</Typography>
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
                <Typography gutterBottom>Brightness</Typography>
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
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Color Gradient Preview
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
          Preview of the gradient based on current mapping and algorithm.
        </Typography>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <ViewColumnIcon fontSize="small" />
          <Typography variant="subtitle2">Value Distribution (sampled)</Typography>
        </Box>

        {isAnalyzing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2">Analyzing value distribution…</Typography>
          </Box>
        )}

        {dataAnalysis?.statistics && (
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip
              icon={<BarChartIcon />}
              label={`Mean: ${dataAnalysis.statistics.mean.toFixed(2)}`}
              size="small"
            />
            <Chip
              icon={<BarChartIcon />}
              label={`Median: ${dataAnalysis.statistics.median.toFixed(2)}`}
              size="small"
            />
            <Chip
              icon={<BarChartIcon />}
              label={`Std Dev: ${dataAnalysis.statistics.stdDev.toFixed(2)}`}
              size="small"
            />
            <Chip
              icon={<BarChartIcon />}
              label={`Min: ${dataAnalysis.statistics.min.toFixed(2)}`}
              size="small"
            />
            <Chip
              icon={<BarChartIcon />}
              label={`Max: ${dataAnalysis.statistics.max.toFixed(2)}`}
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
                Apply
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
                {`Suitability score: ${Math.round(currentSuitability * 100)} / 100`}
              </Typography>
            )}
          </Alert>
        </Collapse>
      </Paper>
    </Box>
  );
};
