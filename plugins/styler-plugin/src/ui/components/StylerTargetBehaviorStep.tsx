import type { PluginStepProps } from '@hierarchidb/plugin-base';
import {
  Box,
  FormControl,
  FormHelperText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  MAPLIBRE_PROPERTY_METADATA,
  STYLE_TYPE_OPTIONS,
  type StylerConfig,
  StylerConfigDefault,
  type StylerMappingMode,
  type StylerStepData,
  type StylerValueType,
} from '~/common/types/StylerEntity';
import { StyleMappingTargetPanel } from './StyleMappingTargetPanel.tsx';
import { useStylerMappingState } from './useStylerMappingState.ts';

export const StylerTargetBehaviorStep: React.FC<PluginStepProps<StylerStepData>> = ({
  data,
  onChange,
  setValid,
  setError,
}) => {
  const { t } = useTranslation('styler-plugin');
  const { pluginData, settings, handleStyleTypeChange, handleTargetPropertyChange } =
    useStylerMappingState({
      data,
      onChange,
      setValid: () => undefined,
      setError: () => undefined,
      styleTypeOptions: STYLE_TYPE_OPTIONS,
    });
  const targetProperty = pluginData.mapping?.targetProperty ?? null;
  const valueType = useMemo<StylerValueType>(() => {
    if (!targetProperty) return 'color';
    const normalized = targetProperty.toLowerCase();
    if (normalized.endsWith('color')) return 'color';
    if (
      normalized.endsWith('opacity') ||
      normalized.endsWith('radius') ||
      normalized.endsWith('width')
    ) {
      return 'number';
    }
    return MAPLIBRE_PROPERTY_METADATA[targetProperty]?.type ?? 'color';
  }, [targetProperty]);
  const mappingMode: StylerMappingMode =
    (pluginData.mapping?.mappingMode as StylerMappingMode | undefined) ?? 'map-interpolate';
  const currentConfig = useMemo<StylerConfig>(
    () => ({
      ...StylerConfigDefault,
      ...(pluginData.stylerConfig ?? {}),
    }),
    [pluginData.stylerConfig]
  );
  const lastValidity = useRef<boolean | null>(null);
  const lastError = useRef<string | null>(null);
  const lastValueType = useRef<StylerValueType | null>(null);

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
    if (!targetProperty) return;
    const mappingPatch: Partial<StylerStepData['mapping']> = {};
    if (pluginData.mapping?.valueType !== valueType) {
      mappingPatch.valueType = valueType;
    }
    if (valueType === 'number' && !pluginData.mapping?.mappingMode) {
      mappingPatch.mappingMode = 'map-interpolate';
    }
    const shouldResetNumericRange = valueType === 'number' && lastValueType.current !== 'number';
    const configPatch: Partial<StylerConfig> | null = shouldResetNumericRange
      ? { outputMin: 0, outputMax: 10 }
      : null;
    if (Object.keys(mappingPatch).length > 0 || configPatch) {
      onChange({
        ...(pluginData as StylerStepData),
        mapping: {
          ...(pluginData.mapping ?? {}),
          targetProperty,
          ...mappingPatch,
        },
        stylerConfig: configPatch
          ? {
              ...StylerConfigDefault,
              ...(pluginData.stylerConfig ?? {}),
              ...configPatch,
            }
          : pluginData.stylerConfig,
      });
    }
    lastValueType.current = valueType;
  }, [onChange, pluginData, targetProperty, valueType]);

  const updateMapping = (patch: Partial<StylerStepData['mapping']>) => {
    const safePatch = patch ?? {};
    const nextTargetProperty =
      'targetProperty' in safePatch
        ? (safePatch.targetProperty ?? null)
        : (pluginData.mapping?.targetProperty ?? null);
    onChange({
      ...(pluginData as StylerStepData),
      mapping: {
        ...(pluginData.mapping ?? {}),
        targetProperty: nextTargetProperty,
        ...safePatch,
      },
    });
  };
  const updateStylerConfig = (patch: Partial<StylerConfig>) => {
    const nextConfig: StylerConfig = {
      ...StylerConfigDefault,
      ...(pluginData.stylerConfig ?? {}),
      ...patch,
    };
    onChange({
      ...(pluginData as StylerStepData),
      stylerConfig: nextConfig,
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <StyleMappingTargetPanel
        settings={settings}
        handleStyleTypeChange={handleStyleTypeChange}
        pluginData={pluginData}
        handleTargetPropertyChange={handleTargetPropertyChange}
      />

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
              'Interpolate in MapLibre or store final values directly in feature-atoms.'
            )}
          </FormHelperText>
        </FormControl>
      )}

      <FormControl disabled={valueType !== 'number'}>
        <Typography variant="subtitle2">
          {t('step4.numericRange.label', 'Numeric range')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('step4.numericRange.min', 'Minimum')}
            type="number"
            size="small"
            value={currentConfig.outputMin}
            onChange={(event) => updateStylerConfig({ outputMin: Number(event.target.value) })}
            inputProps={{ step: 0.1 }}
          />
          <TextField
            label={t('step4.numericRange.max', 'Maximum')}
            type="number"
            size="small"
            value={currentConfig.outputMax}
            onChange={(event) => updateStylerConfig({ outputMax: Number(event.target.value) })}
            inputProps={{ step: 0.1 }}
          />
        </Stack>
        <FormHelperText>
          {t(
            'step4.numericRange.help',
            'Set the output range for numeric targets. Defaults are 0.0 to 10.0.'
          )}
        </FormHelperText>
      </FormControl>
    </Box>
  );
};
