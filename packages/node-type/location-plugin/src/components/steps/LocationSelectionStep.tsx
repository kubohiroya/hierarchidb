/**
 * Location Selection Step
 * 地点タイプと地域選択ステップ
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Alert,
  FormControl,
  FormControlLabel,
  Slider,
  TextField,
  Switch,
  Select,
  MenuItem,
  InputLabel,
  Grid2
} from '@mui/material';
import { Settings } from '@mui/icons-material';
import type { LocationWorkingCopy, LocationType } from '../../types';
import { SelectionMatrix, type Country, type LocationTypeConfig, type SelectionState } from '../ui/SelectionMatrix';

interface LocationSelectionStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate: (updates: Partial<LocationWorkingCopy>) => Promise<void>;
}

// サンプル国データ（実際は外部ソースから取得）
const SAMPLE_COUNTRIES: Country[] = [
  { code: 'INTL', name: 'その他 (International/Maritime)', continent: 'International' },
  { code: 'JPN', name: 'Japan', localName: '日本', continent: 'Asia' },
  { code: 'KOR', name: 'South Korea', localName: '대한민국', continent: 'Asia' },
  { code: 'CHN', name: 'China', localName: '中国', continent: 'Asia' },
  { code: 'USA', name: 'United States', continent: 'North America' },
  { code: 'GBR', name: 'United Kingdom', continent: 'Europe' },
  { code: 'DEU', name: 'Germany', localName: 'Deutschland', continent: 'Europe' },
  { code: 'FRA', name: 'France', continent: 'Europe' },
  { code: 'ITA', name: 'Italy', localName: 'Italia', continent: 'Europe' },
  { code: 'ESP', name: 'Spain', localName: 'España', continent: 'Europe' },
  { code: 'CAN', name: 'Canada', continent: 'North America' },
  { code: 'AUS', name: 'Australia', continent: 'Oceania' },
  { code: 'BRA', name: 'Brazil', localName: 'Brasil', continent: 'South America' },
  { code: 'IND', name: 'India', localName: 'भारत', continent: 'Asia' },
  { code: 'RUS', name: 'Russia', localName: 'Россия', continent: 'Europe' }
];

// 地点タイプ設定
const LOCATION_TYPES: LocationTypeConfig[] = [
  {
    id: 'airport' as LocationType,
    name: '空港',
    icon: '✈️',
    color: '#2196F3',
    description: '民間・軍用空港、飛行場',
    estimatedCount: 28000
  },
  {
    id: 'railway_station' as LocationType,
    name: '駅',
    icon: '🚂',
    color: '#4CAF50',
    description: '鉄道駅、地下鉄駅',
    estimatedCount: 45000
  },
  {
    id: 'port' as LocationType,
    name: '港',
    icon: '🚢',
    color: '#FF9800',
    description: '商港、漁港、マリーナ',
    estimatedCount: 12000
  },
  {
    id: 'government' as LocationType,
    name: '行政センター',
    icon: '🏛️',
    color: '#9C27B0',
    description: '首都、県庁所在地、市役所',
    estimatedCount: 8000
  },
  {
    id: 'government' as LocationType,
    name: 'IC',
    icon: '🛣️',
    color: '#607D8B',
    description: 'インターチェンジ、ジャンクション',
    estimatedCount: 15000
  }
];

// 地点タイプ別詳細設定
interface LocationTypeDetailConfig {
  airport: {
    includeHeliports: boolean;
    minRunwayLength: number;
    activeOnly: boolean;
    commercialOnly: boolean;
  };
  railway_station: {
    includeMetro: boolean;
    includeAbandoned: boolean;
    minPlatforms: number;
    intercityOnly: boolean;
  };
  port: {
    includeMarinas: boolean;
    cargoOnly: boolean;
    minDepth: number;
    activeOnly: boolean;
  };
  government: {
    adminLevels: number[];
    populationMin: number;
    capitalOnly: boolean;
    includeHistorical: boolean;
  };
}

const DEFAULT_TYPE_CONFIG: LocationTypeDetailConfig = {
  airport: {
    includeHeliports: false,
    minRunwayLength: 500,
    activeOnly: true,
    commercialOnly: false
  },
  railway_station: {
    includeMetro: true,
    includeAbandoned: false,
    minPlatforms: 1,
    intercityOnly: false
  },
  port: {
    includeMarinas: false,
    cargoOnly: false,
    minDepth: 5,
    activeOnly: true
  },
  government: {
    adminLevels: [2, 4, 6],
    populationMin: 1000,
    capitalOnly: false,
    includeHistorical: false
  }
};

export const LocationSelectionStep: React.FC<LocationSelectionStepProps> = ({
  workingCopy,
  onUpdate
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [typeConfig, setTypeConfig] = useState<LocationTypeDetailConfig>(DEFAULT_TYPE_CONFIG);
  
  // 選択マトリックスの初期化
  const selectionMatrix = useMemo(() => {
    // Convert checkboxState to boolean matrix format
    const matrix: boolean[][] = Array(SAMPLE_COUNTRIES.length).fill(null).map(() => 
      Array(LOCATION_TYPES.length).fill(false)
    );
    
    // Fill matrix based on checkboxState
    Object.entries(workingCopy.checkboxState ?? {}).forEach(([countryCode, typeState]) => {
      const countryIndex = SAMPLE_COUNTRIES.findIndex(c => c.code === countryCode);
      if (countryIndex >= 0) {
        Object.entries(typeState as Record<string, boolean>).forEach(([typeId, selected]) => {
          const typeIndex = LOCATION_TYPES.findIndex(t => t.id === typeId);
          if (typeIndex >= 0 && countryIndex < matrix.length) {
            matrix[countryIndex]![typeIndex] = !!selected;
          }
        });
      }
    });
    
    return matrix;
  }, [workingCopy.checkboxState]);
  
  // マトリックス変更ハンドラー
  const handleMatrixChange = useCallback(async () => {
    // Convert matrix to checkboxState format
    const checkboxState: Record<string, Record<LocationType, boolean>> = {};
    // TODO: Implement proper conversion logic
    await onUpdate({
      checkboxState
    });
  }, [onUpdate]);
  
  // 選択状態変更ハンドラー
  const handleSelectionChange = useCallback(async (state: SelectionState) => {
    await onUpdate({
      selectedCountries: state.selectedCountries,
      locationTypes: state.selectedTypes
    });
  }, [onUpdate]);
  
  // タイプ設定変更ハンドラー
  const handleTypeConfigChange = (type: keyof LocationTypeDetailConfig, config: any) => {
    setTypeConfig(prev => ({
      ...prev,
      [type]: { ...prev[type], ...config }
    }));
  };
  
  // タブ変更ハンドラー
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // アクティブタイプの取得
  const activeType = LOCATION_TYPES[activeTab];
  
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        取得する地点データを選択してください。国と地点タイプの組み合わせでデータを指定できます。
      </Alert>
      
      {/* 選択マトリックス */}
      <Box mb={3}>
        <SelectionMatrix
          countries={SAMPLE_COUNTRIES}
          locationTypes={LOCATION_TYPES}
          value={selectionMatrix}
          onChange={handleMatrixChange}
          onSelectionChange={handleSelectionChange}
        />
      </Box>
      
      {/* 地点タイプ別詳細設定 */}
      <Paper elevation={1} sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Settings color="primary" />
          <Typography variant="h6">地点タイプ別詳細設定</Typography>
        </Box>
        
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          {LOCATION_TYPES.map((type) => (
            <Tab 
              key={type.id}
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <span>{type.icon}</span>
                  <span>{type.name}</span>
                </Box>
              }
            />
          ))}
        </Tabs>
        
        {/* タイプ別設定パネル */}
        {activeType && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              {activeType.icon} {activeType.name}の詳細設定
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {activeType.description}
            </Typography>
            
            {/* 空港設定 */}
            {activeType.id === 'airport' && (
              <Grid2 container spacing={3}>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.airport.includeHeliports}
                        onChange={(e) => handleTypeConfigChange('airport', { includeHeliports: e.target.checked })}
                      />
                    }
                    label="ヘリポートを含む"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.airport.activeOnly}
                        onChange={(e) => handleTypeConfigChange('airport', { activeOnly: e.target.checked })}
                      />
                    }
                    label="運航中のみ"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.airport.commercialOnly}
                        onChange={(e) => handleTypeConfigChange('airport', { commercialOnly: e.target.checked })}
                      />
                    }
                    label="商業便のみ"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <Box>
                    <Typography gutterBottom>最小滑走路長: {typeConfig.airport.minRunwayLength}m</Typography>
                    <Slider
                      value={typeConfig.airport.minRunwayLength}
                      onChange={(_, value) => handleTypeConfigChange('airport', { minRunwayLength: value })}
                      min={300}
                      max={5000}
                      step={100}
                      marks={[
                        { value: 500, label: '500m' },
                        { value: 1500, label: '1.5km' },
                        { value: 3000, label: '3km' }
                      ]}
                    />
                  </Box>
                </Grid2>
              </Grid2>
            )}
            
            {/* 鉄道駅設定 */}
            {activeType.id === 'railway_station' && (
              <Grid2 container spacing={3}>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.railway_station.includeMetro}
                        onChange={(e) => handleTypeConfigChange('railway_station', { includeMetro: e.target.checked })}
                      />
                    }
                    label="地下鉄駅を含む"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.railway_station.includeAbandoned}
                        onChange={(e) => handleTypeConfigChange('railway_station', { includeAbandoned: e.target.checked })}
                      />
                    }
                    label="廃駅を含む"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.railway_station.intercityOnly}
                        onChange={(e) => handleTypeConfigChange('railway_station', { intercityOnly: e.target.checked })}
                      />
                    }
                    label="都市間路線のみ"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <TextField
                    type="number"
                    label="最小ホーム数"
                    value={typeConfig.railway_station.minPlatforms}
                    onChange={(e) => handleTypeConfigChange('railway_station', { minPlatforms: parseInt(e.target.value) || 1 })}
                    size="small"
                    inputProps={{ min: 1, max: 20 }}
                  />
                </Grid2>
              </Grid2>
            )}
            
            {/* 港設定 */}
            {activeType.id === 'port' && (
              <Grid2 container spacing={3}>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.port.includeMarinas}
                        onChange={(e) => handleTypeConfigChange('port', { includeMarinas: e.target.checked })}
                      />
                    }
                    label="マリーナを含む"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.port.cargoOnly}
                        onChange={(e) => handleTypeConfigChange('port', { cargoOnly: e.target.checked })}
                      />
                    }
                    label="貨物港のみ"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.port.activeOnly}
                        onChange={(e) => handleTypeConfigChange('port', { activeOnly: e.target.checked })}
                      />
                    }
                    label="稼働中のみ"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <TextField
                    type="number"
                    label="最小水深 (m)"
                    value={typeConfig.port.minDepth}
                    onChange={(e) => handleTypeConfigChange('port', { minDepth: parseFloat(e.target.value) || 5 })}
                    size="small"
                    inputProps={{ min: 1, max: 50, step: 0.5 }}
                  />
                </Grid2>
              </Grid2>
            )}
            
            {/* 行政センター設定 */}
            {activeType.id === 'government' && (
              <Grid2 container spacing={3}>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>行政レベル</InputLabel>
                    <Select
                      multiple
                      value={typeConfig.government.adminLevels}
                      onChange={(e) => handleTypeConfigChange('government', { 
                        adminLevels: Array.isArray(e.target.value) ? e.target.value : []
                      })}
                      label="行政レベル"
                    >
                      <MenuItem value={2}>国レベル (2)</MenuItem>
                      <MenuItem value={4}>州/県レベル (4)</MenuItem>
                      <MenuItem value={6}>市レベル (6)</MenuItem>
                      <MenuItem value={8}>区レベル (8)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <TextField
                    type="number"
                    label="最小人口"
                    value={typeConfig.government.populationMin}
                    onChange={(e) => handleTypeConfigChange('government', { populationMin: parseInt(e.target.value) || 1000 })}
                    size="small"
                    inputProps={{ min: 0, step: 1000 }}
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.government.capitalOnly}
                        onChange={(e) => handleTypeConfigChange('government', { capitalOnly: e.target.checked })}
                      />
                    }
                    label="首都のみ"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.government.includeHistorical}
                        onChange={(e) => handleTypeConfigChange('government', { includeHistorical: e.target.checked })}
                      />
                    }
                    label="過去の首都を含む"
                  />
                </Grid2>
              </Grid2>
            )}
            
            {/* インターチェンジ設定 */}
            {activeType.id === 'government' && (
              <Grid2 container spacing={3}>
                <Grid2 size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.government.capitalOnly}
                        onChange={(e) => handleTypeConfigChange('government', { capitalOnly: e.target.checked })}
                      />
                    }
                    label="インターチェンジのみ"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.government.includeHistorical}
                        onChange={(e) => handleTypeConfigChange('government', { includeHistorical: e.target.checked })}
                      />
                    }
                    label="名称付きのみ"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.government.includeHistorical}
                        onChange={(e) => handleTypeConfigChange('government', { includeHistorical: e.target.checked })}
                      />
                    }
                    label="SA/PA除外"
                  />
                </Grid2>
              </Grid2>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};
