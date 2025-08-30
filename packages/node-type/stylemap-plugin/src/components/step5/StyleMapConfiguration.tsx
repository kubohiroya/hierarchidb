/**
 * @file StyleMapConfiguration.tsx
 * @description StyleMap configuration UI component (Step 5)
 * 【機能概要】: スタイルマッピング設定UI
 * 【実装方針】: eria-cartographから移植、HierarchiDB UIシステムに適応
 * 🟢 信頼性レベル: MUI準拠のUI実装
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  Alert,
  AlertTitle,
  Button,
  Chip,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  Palette as PaletteIcon,
  Gradient as GradientIcon,
  AutoFixHigh as AutoFixHighIcon,
  ShowChart as ShowChartIcon,
  BarChart as BarChartIcon,
  ViewColumn as ViewColumnIcon,
  Insights as InsightsIcon,
  Info as InfoIcon,
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
import {
  analyzeData,
  extractNumericValues,
  type DataAnalysisResult,
  type AlgorithmRecommendation,
} from '../../utils/dataAnalysis';

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
  csvData?: Array<Record<string, any>>; // CSVデータ全体（分析用）
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
  csvData = [],
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

  // 【自動推奨機能の状態管理】
  const [dataAnalysis, setDataAnalysis] = useState<DataAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(true);

  // 【データ分析の実行】
  useEffect(() => {
    if (selectedValueColumn && csvData.length > 0) {
      setIsAnalyzing(true);
      
      // 非同期でデータ分析を実行
      const analyzeAsync = async () => {
        try {
          // 少し遅延を入れて非同期感を演出
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const numericValues = extractNumericValues(csvData, selectedValueColumn);
          if (numericValues.length > 0) {
            const analysis = analyzeData(numericValues, selectedValueColumn);
            setDataAnalysis(analysis);
          }
        } finally {
          setIsAnalyzing(false);
        }
      };
      
      analyzeAsync();
    }
  }, [selectedValueColumn, csvData]);

  // 【推奨アルゴリズムの適用】
  const applyRecommendation = useCallback(() => {
    if (dataAnalysis?.recommendation) {
      const newConfig = {
        ...localConfig,
        algorithm: dataAnalysis.recommendation.algorithm,
      };
      setLocalConfig(newConfig);
      onChange(newConfig);
      setShowRecommendation(false);
    }
  }, [dataAnalysis, localConfig, onChange]);

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
          {/* 自動推奨アラート（新規追加） */}
          {dataAnalysis && showRecommendation && (
            <Collapse in={showRecommendation}>
              <Paper sx={{ p: 2, bgcolor: 'info.lighter', border: 1, borderColor: 'info.main' }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AutoFixHighIcon color="info" />
                    <Typography variant="subtitle2" color="info.main">
                      アルゴリズム自動推奨
                    </Typography>
                  </Stack>
                  
                  <Alert 
                    severity="info"
                    onClose={() => setShowRecommendation(false)}
                    action={
                      <Button 
                        size="small" 
                        variant="contained"
                        onClick={applyRecommendation}
                        disabled={isAnalyzing}
                        startIcon={isAnalyzing ? <CircularProgress size={16} /> : null}
                      >
                        適用
                      </Button>
                    }
                  >
                    <AlertTitle>
                      「{dataAnalysis.recommendation.algorithm === 'linear' ? '線形' :
                        dataAnalysis.recommendation.algorithm === 'quantile' ? '分位数' :
                        dataAnalysis.recommendation.algorithm === 'jenks' ? '自然分類（Jenks）' :
                        '等間隔'}」を推奨
                    </AlertTitle>
                    {dataAnalysis.recommendation.reasoning}
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      信頼度: {Math.round(dataAnalysis.recommendation.confidence * 100)}%
                    </Typography>
                  </Alert>
                </Stack>
              </Paper>
            </Collapse>
          )}

          {/* Algorithm Selection（改良版） */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              色分類アルゴリズム
            </Typography>
            <ToggleButtonGroup
              value={localConfig.algorithm}
              exclusive
              onChange={handleAlgorithmChange}
              size="small"
              fullWidth
            >
              <ToggleButton value="linear">
                <Stack alignItems="center" spacing={0.5}>
                  <ShowChartIcon fontSize="small" />
                  <Typography variant="caption">線形</Typography>
                  {dataAnalysis && (
                    <Chip 
                      label={`${dataAnalysis.recommendation.suitability.linear}%`}
                      size="small"
                      color={dataAnalysis.recommendation.suitability.linear > 70 ? 'success' : 
                             dataAnalysis.recommendation.suitability.linear > 40 ? 'default' : 'error'}
                      sx={{ height: 16, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>
              </ToggleButton>
              
              <ToggleButton value="quantile">
                <Stack alignItems="center" spacing={0.5}>
                  <BarChartIcon fontSize="small" />
                  <Typography variant="caption">分位数</Typography>
                  {dataAnalysis && (
                    <Chip 
                      label={`${dataAnalysis.recommendation.suitability.quantile}%`}
                      size="small"
                      color={dataAnalysis.recommendation.suitability.quantile > 70 ? 'success' : 
                             dataAnalysis.recommendation.suitability.quantile > 40 ? 'default' : 'error'}
                      sx={{ height: 16, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>
              </ToggleButton>
              
              <ToggleButton value="jenks">
                <Stack alignItems="center" spacing={0.5}>
                  <InsightsIcon fontSize="small" />
                  <Typography variant="caption">自然分類</Typography>
                  {dataAnalysis && (
                    <Chip 
                      label={`${dataAnalysis.recommendation.suitability.jenks}%`}
                      size="small"
                      color={dataAnalysis.recommendation.suitability.jenks > 70 ? 'success' : 
                             dataAnalysis.recommendation.suitability.jenks > 40 ? 'default' : 'error'}
                      sx={{ height: 16, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>
              </ToggleButton>
              
              <ToggleButton value="equal">
                <Stack alignItems="center" spacing={0.5}>
                  <ViewColumnIcon fontSize="small" />
                  <Typography variant="caption">等間隔</Typography>
                  {dataAnalysis && (
                    <Chip 
                      label={`${dataAnalysis.recommendation.suitability.equal}%`}
                      size="small"
                      color={dataAnalysis.recommendation.suitability.equal > 70 ? 'success' : 
                             dataAnalysis.recommendation.suitability.equal > 40 ? 'default' : 'error'}
                      sx={{ height: 16, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
            
            {/* アルゴリズム説明（充実版） */}
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <InfoIcon fontSize="small" color="action" sx={{ mt: 0.5 }} />
                <Box>
                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    {localConfig.algorithm === 'linear' && '線形補間'}
                    {localConfig.algorithm === 'quantile' && '分位数分類'}
                    {localConfig.algorithm === 'jenks' && '自然分類（Jenks Natural Breaks）'}
                    {localConfig.algorithm === 'equal' && '等間隔分類'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {localConfig.algorithm === 'linear' && 
                      '最小値から最大値まで連続的に色を変化させます。データが均等に分布している場合や、連続的な変化を表現したい場合に適しています。'}
                    {localConfig.algorithm === 'quantile' && 
                      '各クラスに同じ数の要素が入るように分類します。データに偏りがある場合でも、バランスの取れた視覚表現が可能です。外れ値の影響を受けにくい特徴があります。'}
                    {localConfig.algorithm === 'jenks' && 
                      'データの自然な区切りを見つけて分類します。クラス内の分散を最小化し、クラス間の分散を最大化することで、データの持つ自然なグループを発見します。計算コストは高いですが、最も意味のある分類が可能です。'}
                    {localConfig.algorithm === 'equal' && 
                      '値の範囲を等間隔に分割します。温度や標高など、連続的で線形な分布のデータに適しています。計算が高速で、理解しやすい分類方法です。'}
                  </Typography>
                  
                  {/* データ特性に基づく適性表示 */}
                  {dataAnalysis && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="primary">
                        あなたのデータでの適合度: {
                          localConfig.algorithm === 'linear' ? dataAnalysis.recommendation.suitability.linear :
                          localConfig.algorithm === 'quantile' ? dataAnalysis.recommendation.suitability.quantile :
                          localConfig.algorithm === 'jenks' ? dataAnalysis.recommendation.suitability.jenks :
                          dataAnalysis.recommendation.suitability.equal
                        }%
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Stack>
            </Box>
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