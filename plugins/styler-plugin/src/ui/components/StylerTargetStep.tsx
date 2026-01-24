import type { PluginStepProps } from '@hierarchidb/plugin-base';
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
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  MapLibreStyleProperty,
  StylerStepData,
  StylerValueType,
  StyleType,
} from '../../common/types/StylerEntity.ts';
import { useStylerTargetStep } from './useStylerTargetStep.js';

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

const styleTypeToSectionId = (styleType?: StyleType): TargetSection['id'] | null => {
  switch (styleType) {
    case 'choropleth':
      return 'area';
    case 'points':
      return 'point';
    case 'lines':
      return 'route';
    default:
      return null;
  }
};

type TargetIndexEntry = { option: TargetOption; sectionId: TargetSection['id'] };

export const StylerTargetStep: React.FC<
  PluginStepProps<StylerStepData> & { showTargetPanel?: boolean }
> = ({ data, onChange, setValid, setError }) => {
  const { t } = useTranslation('styler-plugin');
  const {
    currentMax,
    currentMin,
    handleRangeChange,
    handleTargetSelect,
    isNumericTarget,
    targetOptionId,
    targetProperty,
  } = useStylerTargetStep({
    data,
    onChange,
    setValid,
    setError,
    t,
    numericRangeDefaultsFallback: { min: 0, max: 10 },
  });

  const targetIndex = useMemo(() => {
    const byId = new Map<string, TargetIndexEntry>();
    const byProperty = new Map<MapLibreStyleProperty, TargetIndexEntry[]>();
    for (const section of TARGET_SECTIONS) {
      for (const option of section.options) {
        const entry = { option, sectionId: section.id };
        byId.set(option.id, entry);
        const list = byProperty.get(option.property) ?? [];
        list.push(entry);
        byProperty.set(option.property, list);
      }
    }
    return { byId, byProperty };
  }, []);

  useEffect(() => {
    const mapping = (data?.mapping ?? {}) as Partial<NonNullable<StylerStepData['mapping']>>;
    const resolvedProperty = mapping.targetProperty ?? null;
    if (!resolvedProperty) return;

    const needsValueType = !mapping.valueType;
    const needsStyleType = !mapping.styleType;
    const needsOptionId = !mapping.targetOptionId;
    const needsMappingMode =
      mapping.valueType === 'number' ? !mapping.mappingMode : false;

    if (!needsValueType && !needsStyleType && !needsOptionId && !needsMappingMode) return;

    let resolvedEntry: TargetIndexEntry | undefined = mapping.targetOptionId
      ? targetIndex.byId.get(mapping.targetOptionId)
      : undefined;

    if (!resolvedEntry) {
      const sectionId = styleTypeToSectionId(mapping.styleType);
      if (sectionId) {
        const option = TARGET_SECTIONS.find((section) => section.id === sectionId)?.options.find(
          (candidate) => candidate.property === resolvedProperty
        );
        if (option) {
          resolvedEntry = { option, sectionId };
        }
      }
    }

    if (!resolvedEntry) {
      const matches = targetIndex.byProperty.get(resolvedProperty) ?? [];
      if (matches.length === 1) {
        resolvedEntry = matches[0];
      }
    }

    if (resolvedEntry) {
      handleTargetSelect(resolvedEntry.option, resolvedEntry.sectionId);
    }
  }, [
    data?.mapping?.mappingMode,
    data?.mapping?.styleType,
    data?.mapping?.targetOptionId,
    data?.mapping?.targetProperty,
    data?.mapping?.valueType,
    handleTargetSelect,
    targetIndex,
  ]);

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
                const selected = targetOptionId
                  ? targetOptionId === option.id
                  : targetProperty === option.property;
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
            'Select one target to map your data. Numeric targets enable a range.'
          )}
        </FormHelperText>
      </FormControl>
    </Box>
  );
};
