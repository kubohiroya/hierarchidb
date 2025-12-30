import type React from 'react';
import { useCallback } from 'react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import {
  STYLE_TYPE_OPTIONS,
  type StylerStepData,
  type StylerMapping,
  type StylerConfig,
  StylerConfigDefault,
  MAPLIBRE_PROPERTY_METADATA, type ColorAlgorithm,
} from '../../common/types/StylerEntity.ts';
import { useTranslation } from 'react-i18next';
import { useStylerMappingState } from './useStylerMappingState.ts';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaletteIcon from '@mui/icons-material/Palette';
import ContrastIcon from '@mui/icons-material/Contrast';
import BarChartIcon from '@mui/icons-material/BarChart';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { generateColorGradient } from '../../common/utils/colorUtils.ts';
import { ValueHistogram } from '@hierarchidb/spreadsheet-plugin/ui';
import { valueToColor } from '../../common/utils/colorUtils.ts';
import { calculateStatistics } from '../../common/utils/dataAnalysis.ts';
import { GradientSwatch } from './GradientSwatch.tsx';
import { Insights as InsightsIcon, ShowChart as ShowChartIcon } from '@mui/icons-material';

export const StylerAlgorithmStep2: React.FC<
  PluginStepProps<StylerStepData> & { showTargetPanel?: boolean }
> = ({
       data,
       onChange,
       setValid,
       setError,
     }) => {
  const { t } = useTranslation('styler-plugin');
  const {
//menuContainer,
    pluginData,
  } = useStylerMappingState({
    data,
    onChange,
    setValid,
    setError,
    //dialogRef,
    styleTypeOptions: STYLE_TYPE_OPTIONS,
  });

  const valueColumn =
    pluginData.valueColumn ?? '';

  const targetProperty = pluginData.mapping?.targetProperty ?? null;
  const targetMeta = targetProperty ? MAPLIBRE_PROPERTY_METADATA[targetProperty] : null;
  const isColorTarget = targetMeta?.type === 'color';

  const initialConfig = useMemo<StylerConfig>(() => {
    const cfg = pluginData.stylerConfig ?? StylerConfigDefault;
    return { ...StylerConfigDefault, ...cfg };
  }, [pluginData.stylerConfig]);

  const [localConfig, setLocalConfig] = useState<StylerConfig>(initialConfig);
  const [binCount, setBinCount] = useState<number>(256);

  useEffect(() => {
    setLocalConfig((prev) => ({ ...prev, ...initialConfig }));
  }, [initialConfig]);

  const applyConfigPatch = (patch: Partial<StylerConfig>) => {
    setLocalConfig((prev) => {
      const next = { ...prev, ...patch };
      onChange({
        ...(pluginData as StylerStepData),
        stylerConfig: next,
      });
      return next;
    });
  };

  const previewRows = useMemo(
    () => (Array.isArray(pluginData.previewRows) ? pluginData.previewRows : []),
    [pluginData.previewRows]
  );
  const deferredPreviewRows = useDeferredValue(previewRows);
  const isPreviewDeferred = deferredPreviewRows !== previewRows;

  const numericValues = useMemo(() => {
    if (!valueColumn) return [] as number[];
    return deferredPreviewRows
      .map((row) => (row as Record<string, unknown>)[valueColumn])
      .map((val) => (typeof val === 'number' ? val : typeof val === 'string' ? Number(val) : NaN))
      .filter((v: number) => Number.isFinite(v));
  }, [deferredPreviewRows, valueColumn]);

  const histogramStats = useMemo(
    () => (numericValues.length ? calculateStatistics(numericValues) : null),
    [numericValues]
  );

  const histogramBarColor = useMemo(() => {
    const mapping = {
      keyColumn: pluginData.keyColumn ?? '',
      valueColumn,
      styleType:
        pluginData.mapping?.styleType ?? 'choropleth',
      targetProperty: pluginData.mapping?.targetProperty ?? null,
    } as StylerMapping;
    // preview用は実データ範囲に合わせてmin/maxを補正する
    const previewConfig: StylerConfig = {
      ...localConfig,
      min: histogramStats?.min ?? localConfig.min,
      max: histogramStats?.max ?? localConfig.max,
    };
    return ({
              midpoint,
            }: {
      midpoint: number;
    }) => valueToColor(midpoint, mapping, previewConfig, numericValues).color;
  }, [histogramStats?.max, histogramStats?.min, localConfig, numericValues, pluginData, valueColumn]);

  const algorithmDescriptions = useMemo(
    () =>
      ({
        linear: t(
          'step5.algorithms.linearDescription',
          'Interpolates colors smoothly between minimum and maximum values. Ideal for evenly distributed data or when visualizing continuous transitions.'
        ),
        log: t(
          'step5.algorithms.logDescription',
          'Uses a logarithmic scale to emphasize smaller values while compressing large outliers. Suited for highly skewed distributions.'
        ),
        quantile: t(
          'step5.algorithms.quantileDescription',
          'Creates classes with an equal number of features. Produces balanced visuals even for skewed data and is resilient to outliers.'
        ),
      }) as Record<ColorAlgorithm, string>,
    [t]
  );

  const handleInvertColorsChange = useCallback(
    (_event: React.ChangeEvent<HTMLInputElement>, newValue: string) => {
      const inverted = newValue === 'inverted';
      const newConfig = { ...localConfig, invertColors: inverted };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const presetScales: Array<{ id: string; label: string; stops: string[] }> = useMemo(
    () => [
      { id: 'grayscale', label: t('styleSettings.algorithm.scale.grayscale', 'Grayscale'), stops: ['#000000', '#ffffff'] },
      { id: 'redgreen', label: t('styleSettings.algorithm.scale.redGreen', 'Red → Green'), stops: ['#ff0000', '#00ff00'] },
      { id: 'blueorange', label: t('styleSettings.algorithm.scale.blueOrange', 'Blue → Orange'), stops: ['#1a1c7c', '#ffa500'] },
      { id: 'viridis', label: t('styleSettings.algorithm.scale.viridis', 'Viridis'), stops: ['#440154', '#21908d', '#fde725'] },
      { id: 'magma', label: t('styleSettings.algorithm.scale.magma', 'Magma'), stops: ['#000004', '#b5367a', '#fbfcbf'] },
      { id: 'custom', label: t('styleSettings.algorithm.scale.custom', 'Custom (HSB)'), stops: [] },
    ],
    [t]
  );

  const handlePresetSelect = (id: string) => {
    const preset = presetScales.find((p) => p.id === id);
    if (!preset) return;
    applyConfigPatch({
      colorSpace: 'hsv',
      colorScheme: id as StylerConfig['colorScheme'],
      startColor: preset.stops[0],
      endColor: preset.stops[preset.stops.length - 1],
    });
  };

  const numericRangeControls = !isColorTarget ? (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">{t('styleSettings.algorithm.numericRange', 'Numeric range')}</Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          type="number"
          label={t('styleSettings.algorithm.min', 'Min')}
          value={localConfig.min}
          onChange={(e) => applyConfigPatch({ min: Number(e.target.value) })}
          size="small"
          inputProps={{ step: 0.1 }}
        />
        <TextField
          type="number"
          label={t('styleSettings.algorithm.max', 'Max')}
          value={localConfig.max}
          onChange={(e) => applyConfigPatch({ max: Number(e.target.value) })}
          size="small"
          inputProps={{ step: 0.1 }}
        />
      </Stack>
      <Typography variant="subtitle2">{t('styleSettings.algorithm.outputRange', 'Output range')}</Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          type="number"
          label={t('styleSettings.algorithm.outputMin', 'Output Min')}
          value={localConfig.outputMin}
          onChange={(e) => applyConfigPatch({ outputMin: Number(e.target.value) })}
          size="small"
          inputProps={{ step: 0.1 }}
        />
        <TextField
          type="number"
          label={t('styleSettings.algorithm.outputMax', 'Output Max')}
          value={localConfig.outputMax}
          onChange={(e) => applyConfigPatch({ outputMax: Number(e.target.value) })}
          size="small"
          inputProps={{ step: 0.1 }}
        />
      </Stack>
    </Stack>
  ) : null;

  const customHSBControls =
    isColorTarget && (localConfig.colorScheme ?? 'grayscale') === 'custom' ? (
      <Stack spacing={1.5} sx={{ mt: 1 }}>
        <Typography variant="subtitle2">{t('styleSettings.algorithm.customTitle', 'Custom HSB')}</Typography>
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
          <Slider value={localConfig.hueStart} onChange={(_e, v) => applyConfigPatch({ hueStart: v as number })} min={0} max={360} />
          <Typography variant="caption">{t('styleSettings.hsv.hueEnd', 'Hue End')}</Typography>
          <Slider value={localConfig.hueEnd} onChange={(_e, v) => applyConfigPatch({ hueEnd: v as number })} min={0} max={360} />
          <Typography variant="caption">{t('styleSettings.hsv.saturation', 'Saturation')}</Typography>
          <Slider value={localConfig.saturation} step={0.05} min={0} max={1} onChange={(_e, v) => applyConfigPatch({ saturation: v as number })} />
          <Typography variant="caption">{t('styleSettings.hsv.brightness', 'Brightness')}</Typography>
          <Slider value={localConfig.brightness} step={0.05} min={0} max={1} onChange={(_e, v) => applyConfigPatch({ brightness: v as number })} />
        </Stack>
      </Stack>
    ) : null;

  return (
    <Stack spacing={2}>
      {isPreviewDeferred && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            {t('styleSettings.processing', 'Processing tabular data...')}
          </Typography>
          <LinearProgress />
        </Stack>
      )}

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
                onChange={(e) => applyConfigPatch({ nullHandling: e.target.value as 'exclude' | 'zero' })}
              >
                <FormControlLabel value="exclude" control={<Radio />} label={t('styleSettings.algorithm.null.exclude', 'Exclude rows')} />
                <FormControlLabel value="zero" control={<Radio />} label={t('styleSettings.algorithm.null.zero', 'Treat as 0')} />
              </RadioGroup>
            </FormControl>

            <InputLabel>
              {t('styleSettings.algorithm.rule', 'Mapping rule')}
            </InputLabel>
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
                {t('styleSettings.algorithms.linear', 'Linear')}</ToggleButton>
              <ToggleButton value="log">
                <BarChartIcon fontSize="small" sx={{ mr: 1 }} />
                {t('styleSettings.algorithms.log', 'Logarithmic')}</ToggleButton>
              <ToggleButton value="quantile">
                <InsightsIcon fontSize="small" sx={{ mr: 1 }} />
                {t('styleSettings.algorithms.quantile', 'Quantile')}</ToggleButton>
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
                  <FormControlLabel control={<Radio />} value="normal" label={t('step5.colorRange.normal', 'normal')} />
                  <FormControlLabel control={<Radio />} value="inverted" label={t('step5.colorRange.invert', 'inverted')} />
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
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                        {preset.id === 'custom' ? <ContrastIcon fontSize="small" /> : <PaletteIcon fontSize="small" />}
                        <Typography variant="body2" noWrap>
                          {preset.label}
                        </Typography>
                      </Stack>
                      {preset.stops.length > 0 ? <GradientSwatch stops={preset.stops} /> : null}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                {customHSBControls}

                <Box sx={{ paddingLeft: 6, paddingRight: 2, height: 32, borderRadius: 25, border: (theme) => `1px solid ${theme.palette.divider}` }}>
                  <Box
                    sx={{
                      height: '100%',
                      background: generateColorGradient(localConfig),
                      borderRadius: 1,
                    }}
                  />
                </Box>

              </Stack>
            ) : null}
          </Stack>
          <Stack spacing={2}>
            <Box sx={{paddingLeft: 6, paddingRight: 2}} >
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