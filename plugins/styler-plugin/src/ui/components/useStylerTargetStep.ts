import { useCallback, useEffect, useMemo } from 'react';
import {
  MAPLIBRE_PROPERTY_METADATA,
  type MapLibreStyleProperty,
  type StylerConfig,
  StylerConfigDefault,
  type StylerStepData,
  type StylerValueType,
  type StyleType,
} from '../../common/types/StylerEntity.ts';

interface UseStylerTargetStepProps {
  data: unknown;
  onChange: (next: StylerStepData) => void;
  setValid: (isValid: boolean) => void;
  setError: (message: string | null) => void;
  t: (key: string, fallback?: string) => string;
  numericRangeDefaultsFallback: { min: number; max: number };
}

export function useStylerTargetStep({
  data,
  onChange,
  setValid,
  setError,
  t,
  numericRangeDefaultsFallback,
}: UseStylerTargetStepProps) {
  const pluginData = useMemo<Partial<StylerStepData>>(
    () => (typeof data === 'object' && data !== null ? (data as Partial<StylerStepData>) : {}),
    [data]
  );

  const targetProperty = pluginData.mapping?.targetProperty ?? null;
  const targetOptionId = pluginData.mapping?.targetOptionId ?? null;
  const selectedValueType = useMemo(
    () => (targetProperty ? getValueTypeForProperty(targetProperty) : 'color'),
    [targetProperty]
  );
  const currentConfig = useMemo<StylerConfig>(
    () => ({
      ...StylerConfigDefault,
      ...(pluginData.stylerConfig ?? {}),
    }),
    [pluginData.stylerConfig]
  );
  const numericRangeDefaults = useMemo(
    () => pluginData.mapping?.targetNumericValueRange ?? numericRangeDefaultsFallback,
    [pluginData.mapping?.targetNumericValueRange, numericRangeDefaultsFallback]
  );

  useEffect(() => {
    const isValid = Boolean(targetProperty && pluginData.mapping?.styleType);
    setValid(isValid);
    setError(
      isValid ? null : t('step5.target.validation.required', 'Select a target to continue.')
    );
  }, [pluginData.mapping?.styleType, setError, setValid, t, targetProperty]);

  const applyChange = useCallback(
    (mappingPatch: Partial<StylerStepData['mapping']>, configPatch?: Partial<StylerConfig>) => {
      const nextMapping = {
        ...(pluginData.mapping ?? {}),
        ...mappingPatch,
      } as StylerStepData['mapping'];
      const nextConfig = configPatch
        ? {
            ...currentConfig,
            ...configPatch,
          }
        : currentConfig;
      onChange({
        ...(pluginData as StylerStepData),
        mapping: nextMapping,
        stylerConfig: nextConfig,
      });
    },
    [currentConfig, onChange, pluginData]
  );

  const handleTargetSelect = useCallback(
    (
      option: {
        id: string;
        property: MapLibreStyleProperty;
        defaultRange?: { min: number; max: number };
      },
      sectionId: string
    ) => {
      const currentOptionId = pluginData.mapping?.targetOptionId ?? null;
      const property = option.property;
      const valueType = getValueTypeForProperty(property);
      const rangeDefaults = option.defaultRange ?? numericRangeDefaults;
      const styleType = getStyleTypeForSection(sectionId);
      const mappingPatch: Partial<StylerStepData['mapping']> = {
        targetProperty: property,
        targetOptionId: option.id,
        valueType,
        ...(styleType ? { styleType } : {}),
      };
      if (valueType === 'number' && !pluginData.mapping?.mappingMode) {
        mappingPatch.mappingMode = 'map-interpolate';
      }
      const shouldResetRange = valueType === 'number' && option.id !== currentOptionId;
      if (shouldResetRange) {
        mappingPatch.targetNumericValueRange = { ...rangeDefaults };
      }
      const configPatch = shouldResetRange
        ? {
            outputMin: rangeDefaults.min,
            outputMax: rangeDefaults.max,
          }
        : undefined;
      applyChange(mappingPatch, configPatch);
    },
    [applyChange, numericRangeDefaults, pluginData.mapping]
  );

  const handleRangeChange = useCallback(
    (field: 'min' | 'max', value: number) => {
      const nextDefaults = {
        ...numericRangeDefaults,
        [field]: value,
      };
      applyChange(
        {
          targetNumericValueRange: nextDefaults,
        },
        field === 'min' ? { outputMin: value } : { outputMax: value }
      );
    },
    [applyChange, numericRangeDefaults]
  );

  const isNumericTarget = selectedValueType === 'number';
  const currentMin =
    typeof currentConfig.outputMin === 'number'
      ? currentConfig.outputMin
      : (numericRangeDefaults.min ?? 0);
  const currentMax =
    typeof currentConfig.outputMax === 'number'
      ? currentConfig.outputMax
      : (numericRangeDefaults.max ?? 10);

  return {
    currentMax,
    currentMin,
    handleRangeChange,
    handleTargetSelect,
    isNumericTarget,
    selectedValueType,
    targetOptionId,
    targetProperty,
  };
}

const getValueTypeForProperty = (property: MapLibreStyleProperty): StylerValueType => {
  const normalized = property.toLowerCase();
  if (normalized.endsWith('color')) return 'color';
  if (
    normalized.endsWith('opacity') ||
    normalized.endsWith('radius') ||
    normalized.endsWith('width')
  ) {
    return 'number';
  }
  return MAPLIBRE_PROPERTY_METADATA[property]?.type ?? 'color';
};

const getStyleTypeForSection = (sectionId: string): StyleType | undefined => {
  switch (sectionId) {
    case 'area':
      return 'choropleth';
    case 'point':
      return 'points';
    case 'route':
      return 'lines';
    default:
      return undefined;
  }
};
