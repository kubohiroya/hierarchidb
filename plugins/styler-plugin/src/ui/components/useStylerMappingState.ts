import { useCallback, useEffect, useMemo } from 'react';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import type {
  MapLibreStyleProperty,
  StyleType,
  StylerStepData,
} from '../../common/types/StylerEntity.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isStyleMappingComplete = (dialogData: Partial<StylerStepData>): boolean => {
  if (!isRecord(dialogData)) return false;
  const styleType = dialogData.mapping?.styleType;
  return Boolean(styleType && dialogData.mapping?.targetProperty && dialogData.mapping?.valueColumn);
};

type Params = Pick<
  StepComponentProps<StylerStepData>,
  'data' | 'onChange' | 'setValid' | 'setError' | 'dialogRef'
> & {
  styleTypeOptions: ReadonlyArray<{ value: StyleType; labelKey: string; descriptionKey: string }>;
};

export const useStylerMappingState = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
  styleTypeOptions,
}: Params) => {
  const menuContainer = (dialogRef?.current as Element | null) ?? null;

  const pluginData = useMemo<Partial<StylerStepData>>(
    () => (isRecord(data) ? (data as Partial<StylerStepData>) : {}),
    [data]
  );

  const sanitizedStyleType = useMemo(() => {
    const candidate = (pluginData.mapping?.styleType ??
      (pluginData.stylerConfig as { styleType?: StyleType } | undefined)?.styleType ??
      // Legacy persisted root-level styleType
      (pluginData as { styleType?: StyleType })?.styleType) as StyleType | undefined;
    return styleTypeOptions.some((option) => option.value === candidate) ? candidate : undefined;
  }, [pluginData, styleTypeOptions]);

  const settings = useMemo(
    () =>
      ({
        styleType: sanitizedStyleType,
        colorScheme: pluginData.colorScheme,
      }) as { styleType?: StyleType; colorScheme?: StylerStepData['colorScheme'] },
    [pluginData.colorScheme, sanitizedStyleType]
  );

  const handleStyleTypeChange = useCallback((styleType: StyleType) => {
    const nextStyleType = styleType ?? settings.styleType;
      const nextData: StylerStepData = {
        ...(pluginData as StylerStepData),
        stylerConfig: {
          ...(pluginData.stylerConfig ?? {}),
          styleType: nextStyleType,
        } as StylerStepData['stylerConfig'],
      };
      // delete (nextData as { styleType?: StyleType }).styleType;
      onChange(nextData);
    },
    [pluginData, settings.styleType, onChange]
  );

  const handleTargetPropertyChange = useCallback(
    (targetProperty: MapLibreStyleProperty) => {
      const nextData: StylerStepData = {
        ...(pluginData as StylerStepData),
        stylerConfig: {
          ...(pluginData.stylerConfig ?? {}),
          targetProperty,
        } as StylerStepData['stylerConfig'],
      };
      // delete (nextData as { styleType?: StyleType }).styleType;
      onChange(nextData);
    },
    [pluginData, onChange]
  );

  // Fallback invalid persisted values (e.g., legacy "gradient") to a valid option to avoid out-of-range Select values.
  useEffect(() => {
    if (
      (pluginData.mapping?.styleType || (pluginData as { styleType?: StyleType }).styleType) &&
      !sanitizedStyleType
    ) {
      handleStyleTypeChange('choropleth' as StyleType);
    }
  }, [pluginData, sanitizedStyleType, handleStyleTypeChange]);

  useEffect(() => {
    const valid = isStyleMappingComplete({
      ...(pluginData as StylerStepData),
      mapping: {
        ...(pluginData.mapping ?? {}),
        targetProperty: pluginData.mapping?.targetProperty ?? null,
        styleType: sanitizedStyleType,
      },
      selectedValueColumn: pluginData.selectedValueColumn,
    });
    setValid(valid);
    setError(
      valid
        ? null
        : 'Select a style type, value source, and target property to continue.'
    );
  }, [pluginData, sanitizedStyleType, setValid, setError]);

  return {
    menuContainer,
    pluginData,
    sanitizedStyleType,
    settings,
    handleStyleTypeChange,
    handleTargetPropertyChange,
  };
};
