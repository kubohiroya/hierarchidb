/**
 * Styler extension step component for folder-plugin base-dialog
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'provider-i18next';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Typography,
  Box,
} from '@mui/material';

export interface StylerStepData {
  styleType?: 'choropleth' | 'heatmap' | 'points' | 'lines';
  dataSource?: string;
  colorScheme?: string;
  opacity?: number;
  strokeWidth?: number;
}

interface StylerExtensionStepProps {
  data: StylerStepData;
  onChange: (data: StylerStepData) => void;
  errors?: string[];
  isSubmitting?: boolean;
}

export const StylerExtensionStep: React.FC<StylerExtensionStepProps> = ({
  data,
  onChange,
  errors,
  isSubmitting,
}) => {
  const { t } = useTranslation('styler-plugin');
  const handleStyleTypeChange = useCallback(
    (event: any) => {
      onChange({ ...data, styleType: event.target.value });
    },
    [data, onChange]
  );

  const handleDataSourceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...data, dataSource: event.target.value });
    },
    [data, onChange]
  );

  const handleColorSchemeChange = useCallback(
    (event: any) => {
      onChange({ ...data, colorScheme: event.target.value });
    },
    [data, onChange]
  );

  const handleOpacityChange = useCallback(
    (_event: any, value: number | number[]) => {
      onChange({ ...data, opacity: value as number });
    },
    [data, onChange]
  );

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {t('extension.description', 'Configure Styler visualization settings for this folder')}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel>{t('extension.styleType.label', 'Style Type')}</InputLabel>
          <Select
            value={data.styleType || 'choropleth'}
            onChange={handleStyleTypeChange}
            label={t('extension.styleType.label', 'Style Type')}
          >
            <MenuItem value="choropleth">
              {t('extension.styleType.choropleth', 'Choropleth Map')}
            </MenuItem>
            <MenuItem value="heatmap">{t('extension.styleType.heatmap', 'Heat Map')}</MenuItem>
            <MenuItem value="points">{t('extension.styleType.points', 'Point Map')}</MenuItem>
            <MenuItem value="lines">{t('extension.styleType.lines', 'Line Map')}</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label={t('extension.dataSource.label', 'Data Source')}
          value={data.dataSource || ''}
          onChange={handleDataSourceChange}
          disabled={isSubmitting}
          placeholder={t('extension.dataSource.placeholder', 'e.g., CSV file path or URL')}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel>{t('extension.colorScheme.label', 'Color Scheme')}</InputLabel>
          <Select
            value={data.colorScheme || 'blues'}
            onChange={handleColorSchemeChange}
            label={t('extension.colorScheme.label', 'Color Scheme')}
          >
            <MenuItem value="blues">{t('extension.colorScheme.blues', 'Blues')}</MenuItem>
            <MenuItem value="reds">{t('extension.colorScheme.reds', 'Reds')}</MenuItem>
            <MenuItem value="greens">{t('extension.colorScheme.greens', 'Greens')}</MenuItem>
            <MenuItem value="viridis">{t('extension.colorScheme.viridis', 'Viridis')}</MenuItem>
            <MenuItem value="plasma">{t('extension.colorScheme.plasma', 'Plasma')}</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Box>
          <Typography gutterBottom>
            {t('extension.opacity.label', 'Opacity')}: {data.opacity || 0.7}
          </Typography>
          <Slider
            value={data.opacity || 0.7}
            onChange={handleOpacityChange}
            min={0}
            max={1}
            step={0.1}
            marks
            disabled={isSubmitting}
          />
        </Box>
      </Grid>

      {errors && errors.length > 0 && (
        <Grid item xs={12}>
          <Typography color="error" variant="body2">
            {errors.join(', ')}
          </Typography>
        </Grid>
      )}
    </Grid>
  );
};

export default StylerExtensionStep;
