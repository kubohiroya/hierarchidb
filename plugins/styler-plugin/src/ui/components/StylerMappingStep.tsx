import {
  Box,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MapLibreStyleProperty, StylerStepData, StyleType } from '../../common/types/StylerEntity.js';
import { MAPLIBRE_PROPERTY_GROUPS, MAPLIBRE_PROPERTY_METADATA} from '../../common/types/StylerEntity.js';
import { ModalSelect } from '@hierarchidb/ui-modal-select';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import { useStylerMappingState } from './useStylerMappingState.js';
export { isStyleMappingComplete } from './useStylerMappingState.js';

const STYLE_TYPE_OPTIONS: ReadonlyArray<{
  value: StyleType;
  labelKey: string;
  descriptionKey: string;
  icon: string;
}> = [
  {
    value: 'choropleth',
    labelKey: 'styleSettings.styleType.options.choropleth',
    descriptionKey: 'styleSettings.styleType.descriptions.choropleth',
    icon: 'shape',
  },
  {
    value: 'points',
    labelKey: 'styleSettings.styleType.options.points',
    descriptionKey: 'styleSettings.styleType.descriptions.points',
    icon: 'location',
  },
  {
    value: 'lines',
    labelKey: 'styleSettings.styleType.options.lines',
    descriptionKey: 'styleSettings.styleType.descriptions.lines',
    icon: 'route',
  },
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

export const StylerMappingStep: React.FC<StepComponentProps<StylerStepData>> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
}) => {
  const { t } = useTranslation('styler-plugin');
  const { resolveIcon } = useIconRegistry();
  const {
    menuContainer,
    pluginData,
    columns,
    settings,
    updateSettings,
    handleValueColumnChange,
    handleTargetPropertyChange,
  } = useStylerMappingState({
    data,
    onChange,
    setValid,
    setError,
    dialogRef,
    styleTypeOptions: STYLE_TYPE_OPTIONS,
  });

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

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {t('styleSettings.styleType.label', 'Style Type')}
        </Typography>
        <Grid container spacing={2}>
          {STYLE_TYPE_OPTIONS.map((option) => {
            const selected = settings.styleType === option.value;
            const IconEl = resolveIcon({ nodeType: option.icon });
            return (
              <Grid size={{ xs: 12, sm: 4 }} key={option.value}>
                <Paper
                  role="button"
                  tabIndex={0}
                  onClick={() => updateSettings({ styleType: option.value })}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      updateSettings({ styleType: option.value });
                    }
                  }}
                  elevation={selected ? 4 : 1}
                  sx={{
                    p: 2,
                    border: selected ? '2px solid' : '1px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    cursor: 'pointer',
                    height: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: (theme) => theme.shadows[2],
                    },
                    outline: 'none',
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        bgcolor: selected ? 'primary.light' : 'grey.100',
                        color: selected ? 'primary.contrastText' : 'text.secondary',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: selected ? '1px solid' : '1px solid',
                        borderColor: selected ? 'primary.main' : 'divider',
                        flexShrink: 0,
                      }}
                    >
                      {IconEl}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" noWrap>
                        {t(option.labelKey, option.labelKey)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t(option.descriptionKey, option.descriptionKey)}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
        <FormHelperText sx={{ mt: 1 }}>
          {t('styleSettings.styleType.help', 'Select the geometry that this style targets.')}
        </FormHelperText>
      </Box>

      <FormControl fullWidth required>
        <InputLabel>{t('styleSettings.targetProperty.label', 'Target style property')}</InputLabel>
        <ModalSelect
          value={pluginData.mapping?.targetProperty ?? ''}
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
