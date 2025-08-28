/**
 * @file StyleMapConfiguration.tsx
 * @description StyleMap configuration UI component (Step 5)
 * 【機能概要】: スタイルマッピング設定UI
 * 【実装方針】: eria-cartographから移植、HierarchiDB UIシステムに適応
 * 🟢 信頼性レベル: MUI準拠のUI実装
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Typography,
  Paper,
  Grid,
  Stack,
  TextField,
  FormHelperText,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Palette as PaletteIcon,
  Gradient as GradientIcon,

} from '@mui/icons-material';

import type {
  StyleMapConfig,
  MapLibreStyleProperty,
  ColorAlgorithm,
  ColorSpace,
} from '../../types/styleMapTypes';
import {
  StyleMapConfigDefault,
  MAPLIBRE_PROPERTY_METADATA,
  MAPLIBRE_PROPERTY_GROUPS,
} from '../../types/styleMapTypes';
import {
  generateColorGradient,
} from '../../utils/colorUtils';

/**
 * 【型定義】: StyleMapConfigurationのプロパティ
 */
export interface StyleMapConfigurationProps {
  config?: StyleMapConfig;
  onChange: (config: StyleMapConfig) => void;
  values?: number[];
  columns?: string[];
  selectedKeyColumn?: string;
  selectedValueColumn?: string;
  onColumnSelect?: (column: string, type: 'key' | 'value') => void;
}

/**
 * 【機能概要】: StyleMap設定UIコンポーネント
 * 【実装方針】: eria-cartographの機能をHierarchiDBのMUIテーマで再実装
 * 【テスト対応】: 設定変更の即時反映、プレビュー機能
 * 🟢 信頼性レベル: 完全なUI実装
 */
export const StyleMapConfiguration: React.FC<StyleMapConfigurationProps> = ({
  config = StyleMapConfigDefault,
  onChange,
  values = [],
  columns = [],
  selectedKeyColumn,
  selectedValueColumn,
  onColumnSelect,
}) => {
  const [localConfig, setLocalConfig] = useState<StyleMapConfig>(() => {
    // Initialize with sample values if available
    if (values.length > 0) {
      const numericValues = values.filter((v) => !isNaN(v));

      if (numericValues.length > 0) {
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        return {
          ...config,
          mapping: {
            ...config.mapping,
            min,
            max,
          },
        };
      }
    }
    return config;
  });

  // 【アルゴリズム変更】
  const handleAlgorithmChange = useCallback((
    _event: React.MouseEvent<HTMLElement>,
    newAlgorithm: ColorAlgorithm | null
  ) => {
    if (newAlgorithm) {
      const newConfig = { ...localConfig, algorithm: newAlgorithm };
      setLocalConfig(newConfig);
      onChange(newConfig);
    }
  }, [localConfig, onChange]);

  // 【カラースペース変更】
  const handleColorSpaceChange = useCallback((
    _event: React.MouseEvent<HTMLElement>,
    newColorSpace: ColorSpace | null
  ) => {
    if (newColorSpace) {
      const newConfig = { ...localConfig, colorSpace: newColorSpace };
      setLocalConfig(newConfig);
      onChange(newConfig);
    }
  }, [localConfig, onChange]);

  // 【マッピング値変更】
  const handleMappingChange = useCallback((
    field: keyof StyleMapConfig['mapping'],
    value: number | number[]
  ) => {
    const numValue = Array.isArray(value) ? value[0] : value;
    const newConfig = {
      ...localConfig,
      mapping: {
        ...localConfig.mapping,
        [field]: numValue,
      },
    };
    setLocalConfig(newConfig);
    onChange(newConfig);
  }, [localConfig, onChange]);

  // 【ターゲットプロパティ変更】
  const handleTargetPropertyChange = useCallback((
    event: any
  ) => {
    const targetProperty = event.target.value as MapLibreStyleProperty;
    const newConfig = { ...localConfig, targetProperty };
    setLocalConfig(newConfig);
    onChange(newConfig);
  }, [localConfig, onChange]);

  // 【カラムセレクト】
  const handleKeyColumnChange = useCallback((event: any) => {
    const column = event.target.value;
    if (onColumnSelect) {
      onColumnSelect(column, 'key');
    }
  }, [onColumnSelect]);

  const handleValueColumnChange = useCallback((event: any) => {
    const column = event.target.value;
    if (onColumnSelect) {
      onColumnSelect(column, 'value');
    }
  }, [onColumnSelect]);

  // 【カラーグラデーションプレビュー】
  const gradientPreview = useMemo(() => {
    return generateColorGradient(localConfig);
  }, [localConfig]);

  // 【プロパティメタデータ取得】
  const targetMetadata = localConfig.targetProperty
    ? MAPLIBRE_PROPERTY_METADATA[localConfig.targetProperty]
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Step Title */}
      <Typography variant="h6" gutterBottom>
        Step 5: Style Mapping Configuration
      </Typography>

      {/* Column Selection */}
      {columns.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Data Column Selection
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Key Column</InputLabel>
                <Select
                  value={selectedKeyColumn || ''}
                  onChange={handleKeyColumnChange}
                  label="Key Column"
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {columns.map((col) => (
                    <MenuItem key={col} value={col}>
                      {col}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Column to use as feature identifier</FormHelperText>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Value Column</InputLabel>
                <Select
                  value={selectedValueColumn || ''}
                  onChange={handleValueColumnChange}
                  label="Value Column"
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {columns.filter(col => col !== selectedKeyColumn).map((col) => (
                    <MenuItem key={col} value={col}>
                      {col}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Column containing values to map</FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Target Property Selection */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          MapLibre Style Property
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Target Property</InputLabel>
          <Select
            value={localConfig.targetProperty || ''}
            onChange={handleTargetPropertyChange}
            label="Target Property"
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {MAPLIBRE_PROPERTY_GROUPS.map((group) => (
              <React.Fragment key={group.name}>
                <MenuItem disabled>
                  <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                    {group.displayName}
                  </Typography>
                </MenuItem>
                {group.properties.map((prop) => (
                  <MenuItem key={prop} value={prop} sx={{ pl: 3 }}>
                    {MAPLIBRE_PROPERTY_METADATA[prop].displayName}
                  </MenuItem>
                ))}
              </React.Fragment>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* Color Configuration */}
      {localConfig.targetProperty && targetMetadata?.type === 'color' && (
        <>
          {/* Algorithm Selection */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Mapping Algorithm
            </Typography>
            <ToggleButtonGroup
              value={localConfig.algorithm}
              exclusive
              onChange={handleAlgorithmChange}
              size="small"
              fullWidth
            >
              <ToggleButton value="linear">Linear</ToggleButton>
              <ToggleButton value="quantile">Quantile</ToggleButton>
              <ToggleButton value="jenks">Jenks</ToggleButton>
              <ToggleButton value="equal">Equal Interval</ToggleButton>
            </ToggleButtonGroup>
            <FormHelperText>
              {localConfig.algorithm === 'linear' && 'Linear interpolation between min and max values'}
              {localConfig.algorithm === 'quantile' && 'Equal number of features in each color class'}
              {localConfig.algorithm === 'jenks' && 'Natural breaks optimization'}
              {localConfig.algorithm === 'equal' && 'Equal value ranges for each color class'}
            </FormHelperText>
          </Paper>

          {/* Color Space Selection */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Color Space
            </Typography>
            <ToggleButtonGroup
              value={localConfig.colorSpace}
              exclusive
              onChange={handleColorSpaceChange}
              size="small"
              fullWidth
            >
              <ToggleButton value="hsv">
                <Stack direction="row" spacing={1} alignItems="center">
                  <PaletteIcon fontSize="small" />
                  <span>HSV</span>
                </Stack>
              </ToggleButton>
              <ToggleButton value="rgb">
                <Stack direction="row" spacing={1} alignItems="center">
                  <GradientIcon fontSize="small" />
                  <span>RGB</span>
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
          </Paper>

          {/* Value Range Configuration */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Value Range
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Min Value"
                  type="number"
                  value={localConfig.mapping.min}
                  onChange={(e) => handleMappingChange('min', parseFloat(e.target.value) || 0)}
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Max Value"
                  type="number"
                  value={localConfig.mapping.max}
                  onChange={(e) => handleMappingChange('max', parseFloat(e.target.value) || 100)}
                  size="small"
                  fullWidth
                />
              </Grid>
            </Grid>
          </Paper>

          {/* HSV Configuration */}
          {localConfig.colorSpace === 'hsv' && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                HSV Color Configuration
              </Typography>
              
              {/* Hue Range */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">Hue Range</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="caption" sx={{ minWidth: 40 }}>
                    {localConfig.mapping.hueStart}°
                  </Typography>
                  <Slider
                    value={[localConfig.mapping.hueStart, localConfig.mapping.hueEnd]}
                    onChange={(_e, value) => {
                      if (Array.isArray(value) && value.length >= 2) {
                        handleMappingChange('hueStart', value[0] ?? 0);
                        handleMappingChange('hueEnd', value[1] ?? 360);
                      }
                    }}
                    valueLabelDisplay="auto"
                    min={0}
                    max={360}
                    marks={[
                      { value: 0, label: '0°' },
                      { value: 360, label: '360°' },
                    ]}
                  />
                  <Typography variant="caption" sx={{ minWidth: 40 }}>
                    {localConfig.mapping.hueEnd}°
                  </Typography>
                </Stack>
              </Box>

              {/* Saturation */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">Saturation</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="caption" sx={{ minWidth: 40 }}>
                    {Math.round(localConfig.mapping.saturation * 100)}%
                  </Typography>
                  <Slider
                    value={localConfig.mapping.saturation}
                    onChange={(_e, value) => handleMappingChange('saturation', value as number)}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                    min={0}
                    max={1}
                    step={0.01}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 1, label: '100%' },
                    ]}
                  />
                </Stack>
              </Box>

              {/* Brightness */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">Brightness</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="caption" sx={{ minWidth: 40 }}>
                    {Math.round(localConfig.mapping.brightness * 100)}%
                  </Typography>
                  <Slider
                    value={localConfig.mapping.brightness}
                    onChange={(_e, value) => handleMappingChange('brightness', value as number)}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                    min={0}
                    max={1}
                    step={0.01}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 1, label: '100%' },
                    ]}
                  />
                </Stack>
              </Box>
            </Paper>
          )}

          {/* Color Preview */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Color Scale Preview
            </Typography>
            <Box
              sx={{
                height: 40,
                background: gradientPreview,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
              <Typography variant="caption">
                {localConfig.mapping.min}
              </Typography>
              <Typography variant="caption">
                {localConfig.mapping.max}
              </Typography>
            </Stack>
          </Paper>
        </>
      )}
    </Box>
  );
};