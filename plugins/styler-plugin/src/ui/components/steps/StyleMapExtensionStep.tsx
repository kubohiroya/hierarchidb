/**
 * Styler extension step component for folder-plugin base-dialog
 */

import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

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
    (event: SelectChangeEvent<StylerStepData['styleType']>) => {
      onChange({ ...data, styleType: event.target.value as StylerStepData['styleType'] });
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
    (event: SelectChangeEvent<NonNullable<StylerStepData['colorScheme']>>) => {
      onChange({ ...data, colorScheme: event.target.value });
    },
    [data, onChange]
  );

  const handleOpacityChange = useCallback(
    (_event: Event, value: number | number[]) => {
      onChange({ ...data, opacity: value as number });
    },
    [data, onChange]
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
        },
      }}
    >
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ gridColumn: '1 / -1' }}>
        {t('extension.description', 'Configure Styler visualization settings for this folder')}
      </Typography>

      <FormControl fullWidth disabled={isSubmitting}>
        <InputLabel>{String(t('extension.styleType.label', 'Style Type'))}</InputLabel>
        <Select
          value={data.styleType || 'choropleth'}
          onChange={handleStyleTypeChange}
          label={String(t('extension.styleType.label', 'Style Type'))}
        >
          <MenuItem value="choropleth">
            {t('extension.styleType.choropleth', 'Choropleth Map')}
          </MenuItem>
          <MenuItem value="heatmap">{t('extension.styleType.heatmap', 'Heat Map')}</MenuItem>
          <MenuItem value="points">{t('extension.styleType.points', 'Point Map')}</MenuItem>
          <MenuItem value="lines">{t('extension.styleType.lines', 'Line Map')}</MenuItem>
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label={String(t('extension.dataSource.label', 'Data Source'))}
        value={data.dataSource || ''}
        onChange={handleDataSourceChange}
        disabled={isSubmitting}
        placeholder={String(t('extension.dataSource.placeholder', 'e.g., CSV file path or URL'))}
      />

      <FormControl fullWidth disabled={isSubmitting}>
        <InputLabel>{String(t('extension.colorScheme.label', 'Color Scheme'))}</InputLabel>
        <Select
          value={data.colorScheme || 'blues'}
          onChange={handleColorSchemeChange}
          label={String(t('extension.colorScheme.label', 'Color Scheme'))}
        >
          <MenuItem value="blues">{t('extension.colorScheme.blues', 'Blues')}</MenuItem>
          <MenuItem value="reds">{t('extension.colorScheme.reds', 'Reds')}</MenuItem>
          <MenuItem value="greens">{t('extension.colorScheme.greens', 'Greens')}</MenuItem>
          <MenuItem value="viridis">{t('extension.colorScheme.viridis', 'Viridis')}</MenuItem>
          <MenuItem value="plasma">{t('extension.colorScheme.plasma', 'Plasma')}</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
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

      {errors && errors.length > 0 && (
        <Typography color="error" variant="body2" sx={{ gridColumn: '1 / -1' }}>
          {errors.join(', ')}
        </Typography>
      )}
    </Box>
  );
};
