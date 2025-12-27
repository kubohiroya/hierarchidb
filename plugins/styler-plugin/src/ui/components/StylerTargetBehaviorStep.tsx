import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import {
  MAPLIBRE_PROPERTY_METADATA,
  type StylerStepData,
  type StylerValueType,
  type StylerMappingMode,
} from '../../common/types/StylerEntity.js';
import { StyleMappingTargetPanel } from './StyleMappingTargetPanel.tsx';
import { Box, FormControl, FormHelperText, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useStylerMappingState } from './useStylerMappingState.ts';
import { STYLE_TYPE_OPTIONS } from '../../common/types/StylerEntity.js';

export const StylerTargetBehaviorStep: React.FC<PluginStepProps<StylerStepData>> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
}) => {
  const { t } = useTranslation('styler-plugin');
  const { menuContainer, pluginData, settings, handleStyleTypeChange, handleTargetPropertyChange } =
    useStylerMappingState({
      data,
      onChange,
      setValid: () => undefined,
      setError: () => undefined,
      dialogRef,
      styleTypeOptions: STYLE_TYPE_OPTIONS,
    });
  const targetProperty = pluginData.mapping?.targetProperty ?? null;
  const targetMeta = targetProperty ? MAPLIBRE_PROPERTY_METADATA[targetProperty] : null;
  const valueType: StylerValueType =
    (pluginData.mapping?.valueType as StylerValueType | undefined) ?? targetMeta?.type ?? 'color';
  const mappingMode: StylerMappingMode =
    (pluginData.mapping?.mappingMode as StylerMappingMode | undefined) ?? 'map-interpolate';
  const lastValidity = useRef<boolean | null>(null);
  const lastError = useRef<string | null>(null);

  const isValid = useMemo(() => {
    const hasTarget = Boolean(settings.styleType && targetProperty);
    if (!hasTarget) return false;
    if (valueType === 'number') {
      return Boolean(mappingMode);
    }
    return true;
  }, [mappingMode, settings.styleType, targetProperty, valueType]);

  useEffect(() => {
    if (lastValidity.current !== isValid) {
      lastValidity.current = isValid;
      setValid(isValid);
    }
    const errorMessage = isValid
      ? null
      : t('step4.validation.required', 'Select a style target and behavior to continue.');
    if (lastError.current !== errorMessage) {
      lastError.current = errorMessage;
      setError(errorMessage);
    }
  }, [isValid, setError, setValid, t]);

  useEffect(() => {
    if (!targetMeta) return;
    if (!pluginData.mapping?.valueType) {
      onChange({
        ...(pluginData as StylerStepData),
        mapping: {
          ...(pluginData.mapping ?? {}),
          targetProperty: pluginData.mapping?.targetProperty ?? null,
          valueType: targetMeta.type as StylerValueType,
        },
      });
    }
  }, [onChange, pluginData, targetMeta]);

  const updateMapping = (patch: Partial<StylerStepData['mapping']>) => {
    const safePatch = patch ?? {};
    const nextTargetProperty =
      'targetProperty' in safePatch
        ? safePatch.targetProperty ?? null
        : pluginData.mapping?.targetProperty ?? null;
    onChange({
      ...(pluginData as StylerStepData),
      mapping: {
        ...(pluginData.mapping ?? {}),
        targetProperty: nextTargetProperty,
        ...safePatch,
      },
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <StyleMappingTargetPanel
        settings={settings}
        handleStyleTypeChange={handleStyleTypeChange}
        pluginData={pluginData}
        menuContainer={menuContainer}
        handleTargetPropertyChange={handleTargetPropertyChange}
      />

      <FormControl>
        <Typography variant="subtitle2">
          {t('step4.valueType.label', 'Value Type')}
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={valueType}
          onChange={(_event, nextValue) =>
            nextValue &&
            updateMapping({
              valueType: nextValue,
              mappingMode:
                nextValue === 'number'
                  ? (pluginData.mapping?.mappingMode ?? 'map-interpolate')
                  : pluginData.mapping?.mappingMode,
            })
          }
          size="small"
          sx={{ mt: 1 }}
        >
          <ToggleButton value="number">{t('step4.valueType.number', 'Number')}</ToggleButton>
          <ToggleButton value="color">{t('step4.valueType.color', 'Color')}</ToggleButton>
        </ToggleButtonGroup>
        <FormHelperText>
          {t(
            'step4.valueType.help',
            'Choose whether feature-state stores numeric values or colors.',
          )}
        </FormHelperText>
      </FormControl>

      {valueType === 'number' && (
        <FormControl>
          <Typography variant="subtitle2">
            {t('step4.mappingMode.label', 'Mapping Mode')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={mappingMode}
            onChange={(_event, nextValue) => nextValue && updateMapping({ mappingMode: nextValue })}
            size="small"
            sx={{ mt: 1 }}
          >
            <ToggleButton value="map-interpolate">
              {t('step4.mappingMode.interpolate', 'Map interpolate')}
            </ToggleButton>
            <ToggleButton value="precomputed">
              {t('step4.mappingMode.precomputed', 'Precomputed')}
            </ToggleButton>
          </ToggleButtonGroup>
          <FormHelperText>
            {t(
              'step4.mappingMode.help',
              'Interpolate in MapLibre or store final values directly in feature-state.',
            )}
          </FormHelperText>
        </FormControl>
      )}
    </Box>
  );
};
