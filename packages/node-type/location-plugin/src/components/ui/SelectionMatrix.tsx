/**
 * Selection Matrix Component
 * 国 × 地点タイプのチェックボックスマトリックス
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Typography,
  TextField,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  IconButton,
  Paper,
  FormControlLabel
} from '@mui/material';
import {
  Search,
  SelectAll
} from '@mui/icons-material';
import type { LocationType } from '../../types';

// 国情報
export interface Country {
  code: string;           // ISO 3166-1 alpha-3
  name: string;          // 英語名
  localName?: string;    // 現地語名
  continent: string;
}

// 地点タイプ設定
export interface LocationTypeConfig {
  id: LocationType;
  name: string;
  icon: string;
  color: string;
  description: string;
  estimatedCount?: number;  // 推定データ数
}

// マトリックス選択状態
export interface SelectionState {
  matrix: boolean[][];
  selectedCountries: string[];
  selectedTypes: LocationType[];
  totalSelections: number;
  estimatedDataSize: number;
}

export interface SelectionMatrixProps {
  countries: Country[];
  locationTypes: LocationTypeConfig[];
  value: boolean[][];
  onChange: (matrix: boolean[][]) => void;
  onSelectionChange?: (state: SelectionState) => void;
  disabled?: boolean;
}

// 大陸リスト
const CONTINENTS = [
  'Asia',
  'Europe', 
  'North America',
  'South America',
  'Africa',
  'Oceania',
  'International'
];

// 推定データサイズ計算（簡易版）
const estimateDataSize = (selections: number): number => {
  // 1選択あたり平均50地点、1地点あたり1KB と仮定
  return selections * 50 * 1024;
};

export const SelectionMatrix: React.FC<SelectionMatrixProps> = ({
  countries,
  locationTypes,
  value,
  onChange,
  onSelectionChange,
  disabled = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [continentFilter, setContinentFilter] = useState<string[]>([]);

  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  
  // フィルタリングされた国リスト
  const filteredCountries = useMemo(() => {
    return countries.filter(country => {
      // 検索クエリフィルタ
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!country.name.toLowerCase().includes(query) && 
            !country.localName?.toLowerCase().includes(query) &&
            !country.code.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // 大陸フィルタ
      if (continentFilter.length > 0 && !continentFilter.includes(country.continent)) {
        return false;
      }
      
      // 選択済みフィルタ
      if (showSelectedOnly) {
        const countryIndex = countries.indexOf(country);
        const hasSelection = value[countryIndex]?.some(selected => selected);
        if (!hasSelection) return false;
      }
      
      return true;
    });
  }, [countries, searchQuery, continentFilter, showSelectedOnly, value]);
  
  // 統計計算
  const statistics = useMemo(() => {
    const totalSelections = value.flat().filter(Boolean).length;
    const selectedCountries = new Set<string>();
    const selectedTypes = new Set<LocationType>();
    
    value.forEach((row, countryIndex) => {
      row.forEach((selected, typeIndex) => {
        if (selected) {
          const countryCode = countries[countryIndex]?.code;
          const typeId = locationTypes[typeIndex]?.id;
          if (countryCode) selectedCountries.add(countryCode);
          if (typeId) selectedTypes.add(typeId);
        }
      });
    });
    
    const estimatedDataSize = estimateDataSize(totalSelections);
    
    const state: SelectionState = {
      matrix: value,
      selectedCountries: Array.from(selectedCountries).filter(Boolean),
      selectedTypes: Array.from(selectedTypes).filter(Boolean),
      totalSelections,
      estimatedDataSize
    };
    
    return state;
  }, [value, countries, locationTypes]);
  
  // 変更通知
  React.useEffect(() => {
    onSelectionChange?.(statistics);
  }, [statistics, onSelectionChange]);
  
  // セル変更ハンドラー
  const handleCellChange = useCallback((countryIndex: number, typeIndex: number, checked: boolean) => {
    const newMatrix = value.map((row, ri) => 
      ri === countryIndex 
        ? row.map((cell, ci) => ci === typeIndex ? checked : cell)
        : row
    );
    onChange(newMatrix);
  }, [value, onChange]);
  
  // 行全選択/解除
  const handleRowToggle = useCallback((countryIndex: number) => {
    const row = value[countryIndex] || [];
    const allSelected = row.every(Boolean);
    const newMatrix = value.map((r, ri) => 
      ri === countryIndex 
        ? r.map(() => !allSelected)
        : r
    );
    onChange(newMatrix);
  }, [value, onChange]);
  
  // 列全選択/解除
  const handleColumnToggle = useCallback((typeIndex: number) => {
    const allSelected = value.every(row => row[typeIndex]);
    const newMatrix = value.map(row => 
      row.map((cell, ci) => ci === typeIndex ? !allSelected : cell)
    );
    onChange(newMatrix);
  }, [value, onChange]);
  
  // 全選択/解除
  const handleSelectAll = useCallback(() => {
    const hasAnySelection = value.some(row => row.some(Boolean));
    const newMatrix = value.map(row => row.map(() => !hasAnySelection));
    onChange(newMatrix);
  }, [value, onChange]);
  
  // データサイズのフォーマット
  const formatDataSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  // 処理時間予測
  const estimateProcessingTime = (selections: number): string => {
    const minutes = Math.ceil(selections / 100); // 100選択あたり1分と仮定
    if (minutes < 1) return '1分未満';
    if (minutes < 60) return `約 ${minutes} 分`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `約 ${hours}時間${mins > 0 ? mins + '分' : ''}`;
  };
  
  return (
    <Box>
      {/* 検索・フィルタ・統計エリア */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        {/* 検索バー */}
        <Box display="flex" gap={2} alignItems="center" mb={2}>
          <TextField
            size="small"
            placeholder="国名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />
            }}
            sx={{ flex: 1 }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={showSelectedOnly}
                onChange={(e) => setShowSelectedOnly(e.target.checked)}
                size="small"
              />
            }
            label="選択済みのみ"
          />
        </Box>
        
        {/* 大陸フィルタ */}
        <Box mb={2}>
          <ToggleButtonGroup
            value={continentFilter}
            onChange={(_, newFilter) => setContinentFilter(newFilter)}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 1 }}
          >
            {CONTINENTS.map(continent => (
              <ToggleButton key={continent} value={continent}>
                {continent}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        
        {/* 統計表示 */}
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <Chip
            label={`${statistics.totalSelections} 選択中`}
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`推定 ${formatDataSize(statistics.estimatedDataSize)}`}
            color="info"
            variant="outlined"
          />
          <Chip
            label={`処理時間: ${estimateProcessingTime(statistics.totalSelections)}`}
            color="warning"
            variant="outlined"
          />
          
          {/* 全選択/解除ボタン */}
          <Box flex={1} display="flex" justifyContent="flex-end" gap={1}>
            <Tooltip title="全選択">
              <IconButton size="small" onClick={handleSelectAll} disabled={disabled}>
                <SelectAll />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>
      
      {/* マトリックステーブル */}
      <TableContainer component={Paper} elevation={1}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {/* 左上角セル - 全選択 */}
              <TableCell sx={{ width: 200, bgcolor: 'grey.100' }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Checkbox
                    indeterminate={statistics.totalSelections > 0 && 
                      statistics.totalSelections < countries.length * locationTypes.length}
                    checked={statistics.totalSelections > 0}
                    onChange={handleSelectAll}
                    disabled={disabled}
                    size="small"
                  />
                  <Typography variant="body2" fontWeight="bold">
                    国 / タイプ
                  </Typography>
                </Box>
              </TableCell>
              
              {/* 地点タイプヘッダー */}
              {locationTypes.map((type, typeIndex) => (
                <TableCell 
                  key={type.id} 
                  sx={{ 
                    minWidth: 80, 
                    textAlign: 'center',
                    bgcolor: 'grey.50',
                    cursor: disabled ? 'default' : 'pointer'
                  }}
                  onClick={() => !disabled && handleColumnToggle(typeIndex)}
                >
                  <Tooltip title={type.description}>
                    <Box>
                      <Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mb={0.5}>
                        <Typography variant="body2">{type.icon}</Typography>
                        <Checkbox
                          checked={value.every(row => row[typeIndex])}
                          indeterminate={value.some(row => row[typeIndex]) && !value.every(row => row[typeIndex])}
                          disabled={disabled}
                          size="small"
                        />
                      </Box>
                      <Typography variant="caption" display="block">
                        {type.name}
                      </Typography>
                      {type.estimatedCount && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          ~{type.estimatedCount}
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          
          <TableBody>
            {filteredCountries.map(country => {
              const countryIndex = countries.indexOf(country);
              const row = value[countryIndex] || [];
              const hasSelection = row.some(Boolean);
              
              return (
                <TableRow key={country.code} hover>
                  {/* 国名セル */}
                  <TableCell 
                    sx={{ 
                      cursor: disabled ? 'default' : 'pointer',
                      bgcolor: hasSelection ? 'primary.50' : 'inherit'
                    }}
                    onClick={() => !disabled && handleRowToggle(countryIndex)}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <Checkbox
                        checked={row.every(Boolean)}
                        indeterminate={row.some(Boolean) && !row.every(Boolean)}
                        disabled={disabled}
                        size="small"
                      />
                      <Box>
                        <Typography variant="body2" fontWeight={hasSelection ? 'bold' : 'normal'}>
                          {country.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {country.code}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  
                  {/* チェックボックスセル */}
                  {locationTypes.map((type, typeIndex) => {
                    const isSelected = row[typeIndex];
                    const estimatedCount = type.estimatedCount;
                    
                    return (
                      <TableCell 
                        key={type.id} 
                        sx={{ textAlign: 'center' }}
                      >
                        <Tooltip title={
                          estimatedCount 
                            ? `推定 ${estimatedCount} 件の${type.name}データ`
                            : `${type.name}データ`
                        }>
                          <Checkbox
                            checked={isSelected}
                            onChange={(e) => handleCellChange(countryIndex, typeIndex, e.target.checked)}
                            disabled={disabled}
                            size="small"
                            color="primary"
                          />
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
            
            {filteredCountries.length === 0 && (
              <TableRow>
                <TableCell colSpan={locationTypes.length + 1} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    条件に一致する国がありません
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};