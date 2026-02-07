import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { ValueHistogram } from '@hierarchidb/spreadsheet-plugin/ui';
import { Insights as InsightsIcon, ShowChart as ShowChartIcon } from '@mui/icons-material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BarChartIcon from '@mui/icons-material/BarChart';
import ContrastIcon from '@mui/icons-material/Contrast';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaletteIcon from '@mui/icons-material/Palette';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  Skeleton,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type React from 'react';
import {
  type StylerConfig,
  type StylerStepData,
} from '../../common/types/StylerEntity.ts';
import { generateColorGradient } from '../../common/utils/colorUtils.ts';
import { GradientSwatch } from './GradientSwatch.tsx';
import { useStylerAlgorithmStep2 } from './useStylerAlgorithmStep2.ts';

export const StylerAlgorithmStep2: React.FC<
  PluginStepProps<StylerStepData> & { showTargetPanel?: boolean }
> = ({ data, onChange, setValid, setError }) => {
  const {
    t,
    theme,
    valueColumn,
    isColorTarget,
    isOpacityTarget,
    localConfig,
    binCount,
    setBinCount,
    applyConfigPatch,
    isPreviewDeferred,
    numericValues,
    histogramStats,
    histogramBarColor,
    algorithmDescriptions,
    handleInvertColorsChange,
    presetScales,
    handlePresetSelect,
    outputMin,
    outputMax,
    previewSteps,
  } = useStylerAlgorithmStep2({ data, onChange, setValid, setError });

  const customHSBControls =
    isColorTarget && (localConfig.colorScheme ?? 'grayscale') === 'custom' ? (
      <Stack spacing={1.5} sx={{ mt: 1 }}>
        <Typography variant="subtitle2">
          {t('styleSettings.algorithm.customTitle', 'Custom HSB')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            label={t('styleSettings.colorRange.start', 'Start Color (hex)')}
            value={localConfig.startColor ?? ''}
            size="small"
            onChange={(e) => applyConfigPatch({ startColor: e.target.value })}
          />
          <TextField
            label={t('styleSettings.colorRange.end', 'End Color (hex)')}
            value={localConfig.endColor ?? ''}
            size="small"
            onChange={(e) => applyConfigPatch({ endColor: e.target.value })}
          />
        </Stack>
        <Stack spacing={1}>
          <Typography variant="caption">{t('styleSettings.hsv.hueStart', 'Hue Start')}</Typography>
          <Slider
            value={localConfig.hueStart}
            onChange={(_e, v) => applyConfigPatch({ hueStart: v as number })}
            min={0}
            max={360}
          />
          <Typography variant="caption">{t('styleSettings.hsv.hueEnd', 'Hue End')}</Typography>
          <Slider
            value={localConfig.hueEnd}
            onChange={(_e, v) => applyConfigPatch({ hueEnd: v as number })}
            min={0}
            max={360}
          />
          <Typography variant="caption">
            {t('styleSettings.hsv.saturation', 'Saturation')}
          </Typography>
          <Slider
            value={localConfig.saturation}
            step={0.05}
            min={0}
            max={1}
            onChange={(_e, v) => applyConfigPatch({ saturation: v as number })}
          />
          <Typography variant="caption">
            {t('styleSettings.hsv.brightness', 'Brightness')}
          </Typography>
          <Slider
            value={localConfig.brightness}
            step={0.05}
            min={0}
            max={1}
            onChange={(_e, v) => applyConfigPatch({ brightness: v as number })}
          />
        </Stack>
      </Stack>
    ) : null;

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5} sx={{ minHeight: 34 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ visibility: isPreviewDeferred ? 'visible' : 'hidden' }}
        >
          {t('styleSettings.processing', 'Processing tabular data...')}
        </Typography>
        <Skeleton
          variant="rectangular"
          height={4}
          sx={{ borderRadius: 999, visibility: isPreviewDeferred ? 'visible' : 'hidden' }}
        />
      </Stack>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AutoFixHighIcon fontSize="small" />
            <Typography variant="subtitle1">
              {t('styleSettings.accordion.algorithm', 'Algorithm')}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormControl component="fieldset">
              <Typography variant="subtitle2" gutterBottom>
                {t('styleSettings.algorithm.nullHandling', 'Null / NaN handling')}
              </Typography>
              <RadioGroup
                row
                value={localConfig.nullHandling ?? 'exclude'}
                onChange={(e) =>
                  applyConfigPatch({ nullHandling: e.target.value as 'exclude' | 'zero' })
                }
              >
                <FormControlLabel
                  value="exclude"
                  control={<Radio />}
                  label={t('styleSettings.algorithm.null.exclude', 'Exclude rows')}
                />
                <FormControlLabel
                  value="zero"
                  control={<Radio />}
                  label={t('styleSettings.algorithm.null.zero', 'Treat as 0')}
                />
              </RadioGroup>
            </FormControl>

            <InputLabel>{t('styleSettings.algorithm.rule', 'Mapping rule')}</InputLabel>
            <ToggleButtonGroup
              exclusive
              value={localConfig.algorithm}
              onChange={(_e, value) =>
                value ? applyConfigPatch({ algorithm: value as StylerConfig['algorithm'] }) : null
              }
              size="small"
            >
              <ToggleButton value="linear">
                <ShowChartIcon fontSize="small" sx={{ mr: 1 }} />
                {t('styleSettings.algorithms.linear', 'Linear')}
              </ToggleButton>
              <ToggleButton value="log">
                <BarChartIcon fontSize="small" sx={{ mr: 1 }} />
                {t('styleSettings.algorithms.log', 'Logarithmic')}
              </ToggleButton>
              <ToggleButton value="quantile">
                <InsightsIcon fontSize="small" sx={{ mr: 1 }} />
                {t('styleSettings.algorithms.quantile', 'Quantile')}
              </ToggleButton>
            </ToggleButtonGroup>

            <Typography variant="body2" sx={{ mt: 1 }}>
              {algorithmDescriptions[localConfig.algorithm]}
            </Typography>

            {isColorTarget ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                  {t('styleSettings.algorithm.colorScale', 'Color scale')}
                </Typography>

                <RadioGroup
                  row
                  value={localConfig.invertColors ? 'inverted' : 'normal'}
                  onChange={handleInvertColorsChange}
                >
                  <FormControlLabel
                    control={<Radio />}
                    value="normal"
                    label={t('step5.colorRange.normal', 'normal')}
                  />
                  <FormControlLabel
                    control={<Radio />}
                    value="inverted"
                    label={t('step5.colorRange.invert', 'inverted')}
                  />
                </RadioGroup>

                <ToggleButtonGroup
                  exclusive
                  color="primary"
                  value={localConfig.colorScheme ?? 'grayscale'}
                  onChange={(_e, value) => value && handlePresetSelect(value as string)}
                  sx={{ flexWrap: 'wrap', gap: 1 }}
                >
                  {presetScales.map((preset) => (
                    <ToggleButton
                      key={preset.id}
                      value={preset.id}
                      sx={{
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        gap: 1,
                        py: 1,
                        minWidth: 220,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ flex: 1, minWidth: 0 }}
                      >
                        {preset.id === 'custom' ? (
                          <ContrastIcon fontSize="small" />
                        ) : (
                          <PaletteIcon fontSize="small" />
                        )}
                        <Typography variant="body2" noWrap>
                          {preset.label}
                        </Typography>
                      </Stack>
                      {preset.stops.length > 0 ? <GradientSwatch stops={preset.stops} /> : null}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                {customHSBControls}

                <Box
                  sx={{
                    paddingLeft: 6,
                    paddingRight: 2,
                    height: 32,
                    borderRadius: 25,
                    border: (themeRef) => `1px solid ${themeRef.palette.divider}`,
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      background: generateColorGradient(localConfig),
                      borderRadius: 1,
                    }}
                  />
                </Box>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                  {isOpacityTarget
                    ? t('step6.opacity.range', 'Opacity range')
                    : t('step6.width.range', 'Width range')}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    type="number"
                    label={t('step6.numericRange.min', 'Minimum')}
                    value={outputMin}
                    onChange={(e) => applyConfigPatch({ outputMin: Number(e.target.value) })}
                    size="small"
                    inputProps={{ step: isOpacityTarget ? 0.01 : 0.1 }}
                  />
                  <TextField
                    type="number"
                    label={t('step6.numericRange.max', 'Maximum')}
                    value={outputMax}
                    onChange={(e) => applyConfigPatch({ outputMax: Number(e.target.value) })}
                    size="small"
                    inputProps={{ step: isOpacityTarget ? 0.01 : 0.1 }}
                  />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  {previewSteps.map((value) => {
                    if (isOpacityTarget) {
                      const clamped = Math.max(0, Math.min(1, value));
                      return (
                        <Box
                          key={`opacity-${value}`}
                          sx={{
                            width: 64,
                            height: 28,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            backgroundColor: `rgba(25, 118, 210, ${clamped})`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                          }}
                        >
                          {value.toFixed(2)}
                        </Box>
                      );
                    }
                    const lineWidth = Math.max(0.5, value);
                    return (
                      <Box
                        key={`width-${value}`}
                        sx={{
                          width: 64,
                          height: 28,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                        }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            height: lineWidth,
                            backgroundColor: theme.palette.text.primary,
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {isOpacityTarget
                    ? t('step6.opacity.help', 'Lower values are more transparent.')
                    : t('step6.width.help', 'Higher values produce thicker lines.')}
                </Typography>
              </Stack>
            )}
          </Stack>
          <Stack spacing={2}>
            <Box sx={{ paddingLeft: 6, paddingRight: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {t('styleSettings.histogram.binCount', 'Number of bins')}
              </Typography>
              <Slider
                value={binCount}
                min={1}
                max={256}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 64, label: '64' },
                  { value: 128, label: '128' },
                  { value: 256, label: '256' },
                ]}
                onChange={(_e, value) => setBinCount(value as number)}
              />
            </Box>
            <Box sx={{ width: '100%', height: 260 }}>
              {histogramStats ? (
                <ValueHistogram
                  values={numericValues}
                  binCount={binCount}
                  width={520}
                  height={260}
                  min={histogramStats.min}
                  max={histogramStats.max}
                  mean={histogramStats.mean}
                  valueLabel={
                    valueColumn ?? (t('styleSettings.keyValuePair.value', 'Value') as string)
                  }
                  keyLabel={t('styleSettings.keyValuePair.key', 'frequency') as string}
                  barColor={({ midpoint }: { midpoint: number }) => histogramBarColor({ midpoint })}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'styleSettings.histogram.empty',
                    'Histogram is unavailable until numeric values are loaded.'
                  )}
                </Typography>
              )}
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};
