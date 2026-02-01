import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { useTheme } from '@mui/material/styles';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type ColorAlgorithm,
  MAPLIBRE_PROPERTY_METADATA,
  STYLE_TYPE_OPTIONS,
  type StylerConfig,
  StylerConfigDefault,
  type StylerMapping,
  type StylerStepData,
} from '../../common/types/StylerEntity.ts';
import { valueToColor } from '../../common/utils/colorUtils.ts';
import { calculateStatistics } from '../../common/utils/dataAnalysis.ts';
import { useStylerMappingState } from './useStylerMappingState.ts';

type StylerAlgorithmStep2Params = Pick<
  PluginStepProps<StylerStepData>,
  'data' | 'onChange' | 'setValid' | 'setError'
>

export const useStylerAlgorithmStep2 = ({
  data,
  onChange,
  setValid,
  setError,
}: StylerAlgorithmStep2Params) => {
  const { t } = useTranslation('styler-plugin');
  const theme = useTheme();
  const {
    pluginData,
  } = useStylerMappingState({
    data,
    onChange,
    setValid,
    setError,
    styleTypeOptions: STYLE_TYPE_OPTIONS,
  });

  const valueColumn = pluginData.valueColumn ?? '';

  const targetProperty = pluginData.mapping?.targetProperty ?? null;
  const targetMeta = targetProperty ? MAPLIBRE_PROPERTY_METADATA[targetProperty] : null;
  const targetKind = useMemo(() => {
    if (!targetProperty) return 'color' as const;
    const normalized = targetProperty.toLowerCase();
    if (normalized.endsWith('opacity')) return 'opacity' as const;
    if (normalized.endsWith('width') || normalized.endsWith('radius')) return 'width' as const;
    return targetMeta?.type === 'color' ? 'color' : 'number';
  }, [targetMeta?.type, targetProperty]);
  const isColorTarget = targetKind === 'color';
  const isOpacityTarget = targetKind === 'opacity';
  const isWidthTarget = targetKind === 'width';

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
    if (!isColorTarget) {
      return () => theme.palette.primary.main;
    }
    const mapping = {
      keyColumn: pluginData.keyColumn ?? '',
      valueColumn,
      styleType: pluginData.mapping?.styleType ?? 'choropleth',
      targetProperty: pluginData.mapping?.targetProperty ?? null,
    } as StylerMapping;
    const previewConfig: StylerConfig = {
      ...localConfig,
      min: histogramStats?.min ?? localConfig.min,
      max: histogramStats?.max ?? localConfig.max,
    };
    return ({ midpoint }: { midpoint: number }) =>
      valueToColor(midpoint, mapping, previewConfig, numericValues).color;
  }, [
    histogramStats?.max,
    histogramStats?.min,
    isColorTarget,
    localConfig,
    numericValues,
    pluginData,
    theme.palette.primary.main,
    valueColumn,
  ]);

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
      {
        id: 'grayscale',
        label: t('styleSettings.algorithm.scale.grayscale', 'Grayscale'),
        stops: ['#000000', '#ffffff'],
      },
      {
        id: 'redgreen',
        label: t('styleSettings.algorithm.scale.redGreen', 'Red → Green'),
        stops: ['#ff0000', '#00ff00'],
      },
      {
        id: 'blueorange',
        label: t('styleSettings.algorithm.scale.blueOrange', 'Blue → Orange'),
        stops: ['#1a1c7c', '#ffa500'],
      },
      {
        id: 'viridis',
        label: t('styleSettings.algorithm.scale.viridis', 'Viridis'),
        stops: ['#440154', '#21908d', '#fde725'],
      },
      {
        id: 'magma',
        label: t('styleSettings.algorithm.scale.magma', 'Magma'),
        stops: ['#000004', '#b5367a', '#fbfcbf'],
      },
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

  const outputRangeDefaults = useMemo(() => {
    if (isOpacityTarget) return { min: 0, max: 1 };
    if (isWidthTarget) return { min: 0.5, max: 10 };
    return { min: 0, max: 10 };
  }, [isOpacityTarget, isWidthTarget]);
  const outputMin = Number.isFinite(localConfig.outputMin)
    ? localConfig.outputMin
    : outputRangeDefaults.min;
  const outputMax = Number.isFinite(localConfig.outputMax)
    ? localConfig.outputMax
    : outputRangeDefaults.max;
  const previewSteps = useMemo(() => {
    const mid = (outputMin + outputMax) / 2;
    return [outputMin, mid, outputMax];
  }, [outputMax, outputMin]);

  return {
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
  };
};
