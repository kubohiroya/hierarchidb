import { Box, FormControl, FormHelperText, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import { TagChipsInput } from '@hierarchidb/ui-plugin-basic-info';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { StylerDialogData, StyleSettingsData, StyleType } from '../types.js';

const STYLE_TYPE_OPTIONS: ReadonlyArray<{ value: StyleType; label: string }> = [
  { value: 'point', label: 'Point Style' },
  { value: 'line', label: 'Line Style' },
  { value: 'polygon', label: 'Polygon Style' },
  { value: 'raster', label: 'Raster Style' },
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

const toStyleSettings = (value: unknown): StyleSettingsData =>
  isRecord(value) ? (value as StyleSettingsData) : {};

export const isStyleSettingsComplete = (dialogData?: unknown): boolean => {
  if (!isRecord(dialogData)) return false;
  const settings = toStyleSettings(dialogData.styleSettings ?? dialogData);
  return Boolean(settings.styleType);
};

export const StyleSettingsStep: React.FC<StepComponentProps<StylerDialogData>> = ({
  data,
  onChange,
  setValid,
  setError,
}) => {
  const { t } = useTranslation('styler-plugin');
  const pluginData = useMemo(() => (isRecord(data) ? (data as Record<string, unknown>) : {}), [data]);
  const settings = useMemo(() => toStyleSettings(pluginData.styleSettings), [pluginData]);

  const updateSettings = useCallback(
    (patch: Partial<StyleSettingsData>) => {
      const next = { ...settings, ...patch };
      onChange({
        ...pluginData,
        styleSettings: next,
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

      <TextField
        fullWidth
        label={t('styleSettings.dataSource.label', 'Style Data Source')}
        value={settings.dataSource ?? ''}
        onChange={(event) => updateSettings({ dataSource: event.target.value || undefined })}
        placeholder={t('styleSettings.dataSource.placeholder', 'e.g., Census dataset or OSM layer')||''}
        helperText={t('styleSettings.dataSource.help', 'Optional note describing where the styling data originates.')}
      />

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          {t('styleSettings.styleTags.label', 'Style Tags')}
        </Typography>
        <TagChipsInput
          value={settings.styleTags ?? []}
          onChange={(next) => updateSettings({ styleTags: next })}
          placeholder={t('styleSettings.styleTags.placeholder', 'Add tags to organize different style presets.')||''}
          label=""
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {t('styleSettings.styleTags.help', 'Tags are stored separately from node tags and help classify visual presets.')}
        </Typography>
      </Box>
    </Box>
  );
};
