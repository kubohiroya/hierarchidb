import {
  Box,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Typography,
} from '@mui/material';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  StylerStepData,
  StyleType,
  MapLibreStyleProperty,
} from '../types.js';
import { MAPLIBRE_PROPERTY_GROUPS, MAPLIBRE_PROPERTY_METADATA } from '../types.js';
import { ModalSelect } from '@hierarchidb/ui-modal-select';
import type { TabularColumnInfo, TabularTableMetadata } from '@hierarchidb/tabular-store';

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

export const isStyleMappingComplete = (dialogData?: unknown): boolean => {
  if (!isRecord(dialogData)) return false;
  const maybeData = dialogData as Partial<StylerStepData>;
  return Boolean(maybeData.styleType && maybeData.stylerConfig?.targetProperty && maybeData.selectedValueColumn);
};

export const StyleSettingsStep: React.FC<StepComponentProps<StylerStepData>> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
}) => {
  const { t } = useTranslation('styler-plugin');
  const menuContainer = (dialogRef?.current as Element | null) ?? null;
  const pluginData = useMemo<Partial<StylerStepData>>(
    () => (isRecord(data) ? (data as Partial<StylerStepData>) : {}),
    [data]
  );
  const columns = useMemo(() => {
    const tableMetadata = pluginData.tabularTableMetadata as TabularTableMetadata | undefined;
    const fromMetadata = (tableMetadata?.columns ?? [])
      .map((col: TabularColumnInfo | string) => (typeof col === 'string' ? col : col.name))
      .filter((name): name is string => Boolean(name));

    const previewColumns = pluginData.lastPreview?.columns;
    const fromPreview = Array.isArray(previewColumns)
      ? previewColumns
          .map((col, index) => {
            if (typeof col === 'string') return col;
            if (col && typeof col === 'object' && 'name' in col) {
              const name = (col as Partial<TabularColumnInfo>).name;
              if (typeof name === 'string' && name.trim()) return name;
            }
            return `col_${index}`;
          })
          .filter(Boolean)
      : [];

    const previewRows = pluginData.lastPreview?.rows;
    const fromRows = Array.isArray(previewRows) && previewRows.length > 0
      ? Object.keys(previewRows[0] as Record<string, unknown>)
      : [];

    const all = [...fromMetadata, ...fromPreview, ...fromRows];
    return Array.from(new Set(all));
  }, [pluginData.lastPreview?.columns, pluginData.lastPreview?.rows, pluginData.tabularTableMetadata]);
  const sanitizedStyleType = useMemo(() => {
    const candidate = pluginData.styleType as StyleType | undefined;
    return STYLE_TYPE_OPTIONS.some((option) => option.value === candidate) ? candidate : undefined;
  }, [pluginData.styleType]);
  const settings = useMemo(
    () =>
      ({
        styleType: sanitizedStyleType,
        colorScheme: pluginData.colorScheme,
      }) as Pick<StylerStepData, 'styleType' | 'colorScheme'>,
    [pluginData, sanitizedStyleType],
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

  const handleValueColumnChange = useCallback(
    (valueColumn: string) => {
      const nextData: StylerStepData = {
        ...(pluginData as StylerStepData),
        selectedValueColumn: valueColumn,
        stylerConfig: {
          ...(pluginData.stylerConfig ?? {}),
          valueColumn,
        } as StylerStepData['stylerConfig'],
      };
      onChange(nextData);
    },
    [pluginData, onChange]
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
      onChange(nextData);
    },
    [pluginData, onChange]
  );

  // Fallback invalid persisted values (e.g., legacy "gradient") to a valid option to avoid out-of-range Select values.
  useEffect(() => {
    if (pluginData.styleType && !sanitizedStyleType) {
      updateSettings({ styleType: 'choropleth' });
    }
  }, [pluginData.styleType, sanitizedStyleType, updateSettings]);

  useEffect(() => {
    const valid = isStyleMappingComplete({
      ...pluginData,
      stylerConfig: pluginData.stylerConfig,
      selectedValueColumn: pluginData.selectedValueColumn,
      styleType: sanitizedStyleType,
    });
    setValid(valid);
    setError(
      valid
        ? null
        : t(
            'styleSettings.validation.required',
            'Select a style type, value source, and target property to continue.'
          )
    );
  }, [pluginData, sanitizedStyleType, setValid, setError, t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6">
          {t('styleSettings.title', 'Style Mapping')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'styleSettings.description',
            'Select the style type, data source column, and target property before configuring algorithms.'
          )}
        </Typography>
      </Box>

      <FormControl fullWidth required>
        <InputLabel>{t('styleSettings.styleType.label', 'Style Type')}</InputLabel>
        <ModalSelect
          value={settings.styleType ?? ''}
          label={t('styleSettings.styleType.label', 'Style Type')}
          onChange={(event) => updateSettings({ styleType: event.target.value as StyleType })}
          menuContainer={menuContainer}
          usePortal={false}
          menuZIndexOffset={200}
        >
          {STYLE_TYPE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {t(`styleSettings.styleType.options.${option.value}`, option.label)}
            </MenuItem>
          ))}
        </ModalSelect>
        <FormHelperText>
          {t('styleSettings.styleType.help', 'Select the geometry that this style targets.')}
        </FormHelperText>
      </FormControl>

      <FormControl fullWidth required>
        <InputLabel>{t('styleSettings.valueColumn.label', 'Property value source')}</InputLabel>
        <ModalSelect
          value={pluginData.selectedValueColumn ?? ''}
          label={t('styleSettings.valueColumn.label', 'Property value source')}
          onChange={(event) => handleValueColumnChange(event.target.value)}
          menuContainer={menuContainer}
          usePortal={false}
          menuZIndexOffset={200}
        >
          <MenuItem value="">
            <em>{t('styleSettings.valueColumn.none', 'Select a column')}</em>
          </MenuItem>
          {columns.map((col: string) => (
            <MenuItem key={col} value={col}>
              {col}
            </MenuItem>
          ))}
        </ModalSelect>
        <FormHelperText>
          {t('styleSettings.valueColumn.help', 'Choose the filtered table column whose values will drive styling.')}
        </FormHelperText>
      </FormControl>

      <FormControl fullWidth required>
        <InputLabel>{t('styleSettings.targetProperty.label', 'Target style property')}</InputLabel>
        <ModalSelect
          value={pluginData.stylerConfig?.targetProperty ?? ''}
          label={t('styleSettings.targetProperty.label', 'Target style property')}
          onChange={(event) => handleTargetPropertyChange(event.target.value as MapLibreStyleProperty)}
          renderValue={(selected) =>
            selected
              ? MAPLIBRE_PROPERTY_METADATA[selected as MapLibreStyleProperty].displayName
              : ''
          }
          menuContainer={menuContainer}
          usePortal={false}
          menuZIndexOffset={200}
        >
          {MAPLIBRE_PROPERTY_GROUPS.flatMap((group) => [
            <MenuItem key={`${group.name}-label`} value="" disabled>
              <Typography variant="overline" color="text.secondary">
                {group.displayName}
              </Typography>
            </MenuItem>,
            ...group.properties.map((property) => (
              <MenuItem key={property} value={property}>
                {MAPLIBRE_PROPERTY_METADATA[property].displayName}
              </MenuItem>
            )),
          ])}
        </ModalSelect>
        <FormHelperText>
          {t('styleSettings.targetProperty.help', 'Select the MapLibre paint property to map this value to.')}
        </FormHelperText>
      </FormControl>
    </Box>
  );
};
