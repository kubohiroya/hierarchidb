import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import {
  MAPLIBRE_PROPERTY_METADATA,
  StylerConfigDefault,
  type MapLibreStyleProperty,
  type StylerConfig,
  type StyleType,
  type StylerStepData,
  type StylerValueType,
} from '../../common/types/StylerEntity.ts';
import { useTranslation } from 'react-i18next';
import {
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Radio,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

type TargetOption = {
  id: string;
  property: MapLibreStyleProperty;
  labelKey: string;
  defaultLabel: string;
  valueType: StylerValueType;
  hasRange?: boolean;
  defaultRange?: {
    min: number;
    max: number;
  };
};

type TargetSection = {
  id: string;
  titleKey: string;
  defaultTitle: string;
  options: TargetOption[];
};

const TARGET_SECTIONS: TargetSection[] = [
  {
    id: 'area',
    titleKey: 'step5.target.sections.area',
    defaultTitle: 'Country / AdminArea',
    options: [
      {
        id: 'area-fill-color',
        property: 'fill-color',
        labelKey: 'step5.target.options.fillColor',
        defaultLabel: 'Fill Color 🎨',
        valueType: 'color',
      },
      {
        id: 'area-fill-opacity',
        property: 'fill-opacity',
        labelKey: 'step5.target.options.fillOpacity',
        defaultLabel: 'Fill Transparency 🪄',
        valueType: 'number',
        defaultRange: { min: 0, max: 1 },
      },
      {
        id: 'area-line-color',
        property: 'line-color',
        labelKey: 'step5.target.options.lineColor',
        defaultLabel: 'Border Color 🎨',
        valueType: 'color',
      },
      {
        id: 'area-line-opacity',
        property: 'line-opacity',
        labelKey: 'step5.target.options.lineOpacity',
        defaultLabel: 'Border Transparency 🪄',
        valueType: 'number',
        defaultRange: { min: 0, max: 1 },
      },
      {
        id: 'area-line-width',
        property: 'line-width',
        labelKey: 'step5.target.options.lineWidth',
        defaultLabel: 'Border Width 📐',
        valueType: 'number',
        hasRange: true,
        defaultRange: { min: 0.5, max: 10 },
      },
    ],
  },
  {
    id: 'point',
    titleKey: 'step5.target.sections.point',
    defaultTitle: 'Location',
    options: [
      {
        id: 'point-color',
        property: 'circle-color',
        labelKey: 'step5.target.options.circleColor',
        defaultLabel: 'Location Display Color 🎨',
        valueType: 'color',
      },
      {
        id: 'point-radius',
        property: 'circle-radius',
        labelKey: 'step5.target.options.circleRadius',
        defaultLabel: 'Location Display Size 📐',
        valueType: 'number',
        hasRange: true,
        defaultRange: { min: 0.5, max: 10 },
      },
    ],
  },
  {
    id: 'route',
    titleKey: 'step5.target.sections.route',
    defaultTitle: 'Route',
    options: [
      {
        id: 'route-line-color',
        property: 'line-color',
        labelKey: 'step5.target.options.routeLineColor',
        defaultLabel: 'Line Color 🎨',
        valueType: 'color',
      },
      {
        id: 'route-line-opacity',
        property: 'line-opacity',
        labelKey: 'step5.target.options.routeLineOpacity',
        defaultLabel: 'Line Transparency 🪄',
        valueType: 'number',
        defaultRange: { min: 0, max: 1 },
      },
      {
        id: 'route-line-width',
        property: 'line-width',
        labelKey: 'step5.target.options.routeLineWidth',
        defaultLabel: 'Line Width 📐',
        valueType: 'number',
        hasRange: true,
        defaultRange: { min: 0.5, max: 10 },
      },
    ],
  },
];

const getValueTypeForProperty = (property: MapLibreStyleProperty): StylerValueType => {
  const normalized = property.toLowerCase();
  if (normalized.endsWith('color')) return 'color';
  if (normalized.endsWith('opacity') || normalized.endsWith('radius') || normalized.endsWith('width')) {
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

export const StylerTargetStep: React.FC<
  PluginStepProps<StylerStepData> & { showTargetPanel?: boolean }
> = ({
  data,
  onChange,
  setValid,
  setError,
}) => {
  const { t } = useTranslation('styler-plugin');
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
  const numericRangeDefaults = useMemo(()=>pluginData.mapping?.targetNumericValueRange ?? {
    min: 0,
    max: 10,
  },[pluginData.mapping?.targetNumericValueRange]);

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
    (option: TargetOption, sectionId: string) => {
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
  const currentMin = typeof currentConfig.outputMin === 'number' ? currentConfig.outputMin : numericRangeDefaults.min ?? 0;
  const currentMax = typeof currentConfig.outputMax === 'number' ? currentConfig.outputMax : numericRangeDefaults.max ?? 10;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {TARGET_SECTIONS.map((section) => (
          <Box key={section.id}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {t(section.titleKey, section.defaultTitle)}
            </Typography>
            <Stack spacing={1}>
              {section.options.map((option) => {
                const selected =
                  targetOptionId ? targetOptionId === option.id : targetProperty === option.property;
                const rangeDisabled = !isNumericTarget || !selected;
                return (
                  <Stack
                    key={option.id}
                    direction="column"
                    spacing={1}
                    sx={{
                      border: '1px solid',
                      borderColor: selected ? 'primary.main' : 'divider',
                      borderRadius: 1.5,
                      px: 1.5,
                      py: 1,
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Radio
                          size="small"
                          checked={selected}
                          onChange={() => handleTargetSelect(option, section.id)}
                          value={option.property}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {t(option.labelKey, option.defaultLabel)}
                        </Typography>
                      }
                      sx={{ minWidth: 0, m: 0, alignItems: 'center', gap: 1 }}
                    />
                    {option.hasRange && !rangeDisabled && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          size="small"
                          type="number"
                          label={t('step5.target.numericRange.min', 'Minimum')}
                          value={currentMin}
                          onChange={(event) => handleRangeChange('min', Number(event.target.value))}
                          disabled={rangeDisabled}
                          inputProps={{ step: 0.1 }}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label={t('step5.target.numericRange.max', 'Maximum')}
                          value={currentMax}
                          onChange={(event) => handleRangeChange('max', Number(event.target.value))}
                          disabled={rangeDisabled}
                          inputProps={{ step: 0.1 }}
                        />
                      </Stack>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Box>
      <FormControl>
        <FormHelperText>
          {t(
            'step5.target.help',
            'Select one target to map your data. Numeric targets enable a range.',
          )}
        </FormHelperText>
      </FormControl>
    </Box>
  );
};
