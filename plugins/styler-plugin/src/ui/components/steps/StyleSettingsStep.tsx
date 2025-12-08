import { Box, FormControl, FormHelperText, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { StylerStepData, StyleType } from '../types.js';

const STYLE_TYPE_OPTIONS: ReadonlyArray<{ value: StyleType; label: string }> = [
  { value: 'choropleth', label: 'Choropleth Map' },
  { value: 'heatmap', label: 'Heat Map' },
  { value: 'points', label: 'Point Map' },
  { value: 'lines', label: 'Line Map' },
];

/*
const COLOR_SCHEME_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'viridis', label: 'Viridis' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'inferno', label: 'Inferno' },
  { value: 'magma', label: 'Magma' },
  { value: 'turbo', label: 'Turbo' },
  { value: 'spectral', label: 'Spectral' },
  { value: 'rdylbu', label: 'RdYlBu' },
  { value: 'custom', label: 'Custom Colors' },
];
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isStyleSettingsComplete = (dialogData?: unknown): boolean => {
  if (!isRecord(dialogData)) return false;
  const maybeData = dialogData as Partial<StylerStepData>;
  return Boolean(maybeData.styleType);
};

export const StyleSettingsStep: React.FC<StepComponentProps<StylerStepData>> = ({
  data,
  onChange,
  setValid,
  setError,
}) => {
  const { t } = useTranslation('styler-plugin');
  const pluginData = useMemo(() => (isRecord(data) ? (data as Record<string, unknown>) : {}), [data]);
  const settings = useMemo(
    () =>
      ({
        styleType: pluginData.styleType,
        colorScheme: pluginData.colorScheme,
      }) as Pick<StylerStepData, 'styleType' | 'colorScheme'>,
    [pluginData],
  );

  const updateSettings = useCallback(
    (patch: Partial<Pick<StylerStepData, 'styleType' | 'colorScheme'>>) => {
      const next = { ...settings, ...patch };
      onChange({
        ...(pluginData as StylerStepData),
        ...next,
      });
    },
    [pluginData, settings, onChange],
  );

  useEffect(() => {
    const valid = Boolean(settings.styleType);
    setValid(valid);
    setError(valid ? null : t('styleSettings.validation.required', 'Select a style type to continue.'));
  }, [settings.styleType, setValid, setError, t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6">
          {t('styleSettings.title', 'Style Settings')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('styleSettings.description', 'Choose rendering defaults for this styler before configuring data mappings.')}
        </Typography>
      </Box>

      <FormControl fullWidth required>
        <InputLabel>{t('styleSettings.styleType.label', 'Style Type')}</InputLabel>
        <Select
          value={settings.styleType ?? ''}
          label={t('styleSettings.styleType.label', 'Style Type')}
          onChange={(event) => updateSettings({ styleType: event.target.value as StyleType })}
        >
          {STYLE_TYPE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {t(`styleSettings.styleType.options.${option.value}`, option.label)}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          {t('styleSettings.styleType.help', 'Select the geometry that this style targets.')}
        </FormHelperText>
      </FormControl>
    </Box>
  );
};
