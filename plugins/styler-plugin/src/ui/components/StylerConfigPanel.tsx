/**
 * @file StylerConfigPanel.tsx
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
import { useCallback } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { StylerConfig, StylerTableRow } from '../../common/types/StylerEntity.js';
import { StylerConfigDefault } from '../../common/types/StylerEntity.js';
import { useStylerConfigPanelState } from './useStylerConfigPanelState.js';

export interface StylerMappingProps {
  config?: StylerConfig;
  onChange: (config: StylerConfig) => void;
  values?: number[];
  selectedValueColumn?: string;
  tabularData?: StylerTableRow[];
}

export const StylerConfigPanel = ({
  config = StylerConfigDefault,
  onChange,
  values = [],
  selectedValueColumn,
  tabularData = [],
}: StylerMappingProps ) => {
  const controlId = useId();

  const { t } = useTranslation('styler-plugin');
  const tStr = useCallback(
    (key: string, defaultValue: string) => {
      const result = t(key, { defaultValue });
      return typeof result === 'string' ? result : defaultValue;
    },
    [t]
  );
  const {
    localConfig,
    algorithmLabels,
    algorithmDescriptions,
    recommendation,
    recommendationTitle,
    recommendationConfidence,
    currentSuitability,
    isAnalyzing,
    dataAnalysis,
    showRecommendation,
    showAdvanced,
    setShowAdvanced,
    applyRecommendation,
    handleAlgorithmChange,
    handleColorSpaceChange,
    handleMappingChange,
    handleInvertColorsChange,
    handleStartColorChange,
    handleEndColorChange,
    gradientPreview,
  } = useStylerConfigPanelState({
    config,
    onChange,
    values,
    selectedValueColumn,
    tabularData,
    tStr,
  });

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
                value={localConfig.min}
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
                value={localConfig.max}
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
                      value={localConfig.startColor ?? ''}
                      onChange={(e) => {
                        handleStartColorChange(e.target.value);
                      }}
                      inputProps={{
                        id: `${controlId}-color-start`,
                        name: 'styler-color-start',
                      }}
                    />
                    <TextField
                      label={t('step5.colorRange.end', 'End Color (hex)')}
                      value={localConfig.endColor ?? ''}
                      onChange={(e) => {
                        handleEndColorChange(e.target.value);
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
                        value={localConfig.hueStart}
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
                        value={localConfig.hueEnd}
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
                        value={localConfig.saturation}
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
                        value={localConfig.brightness}
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
