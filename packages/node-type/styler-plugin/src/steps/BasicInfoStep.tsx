import React, { useState } from 'react';
import { 
  Typography, 
  TextField, 
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { useTranslation } from 'react-i18next';
import { TagInput, CategorySelector } from '@hierarchidb/ui-core';
import { BasicInfoFields } from '@hierarchidb/ui-core';
type TagId = string;
type TagEntity = { id: TagId; name?: string };
import type { StylemapCategory, StylemapCategoryConfig } from '../types/category-types';

/**
 * スタイルマップ基本情報ステップのデータ型
 */
export interface StylemapBasicInfoData {
  name: string;
  description?: string;
  category?: StylemapCategory;
  tags: TagId[];
  styleType: 'point' | 'line' | 'polygon' | 'raster';
  dataSource?: string;
  colorScheme?: string;
}

export interface BasicInfoStepProps {
  data: StylemapBasicInfoData;
  onNext: (data: StylemapBasicInfoData) => void;
  errors?: string[];
  disabled?: boolean;
}

/**
 * スタイルマップ作成・編集のための基本情報入力ステップ
 */
export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  data,
  onNext,
  errors = [],
  disabled = false
}) => {
  const { t } = useTranslation('styler-plugin');
  const tStr = (key: string, def: string): string => {
    const val = t(key, { defaultValue: def } as any);
    return typeof val === 'string' ? val : def;
  };
  const [localData, setLocalData] = useState<StylemapBasicInfoData>(data);

  // カテゴリオプション（i18n対応）
  const categoryOptions: StylemapCategoryConfig[] = [
    { value: 'choropleth' as StylemapCategory, label: t('categories.choropleth', 'Choropleth Map'), color: '#4CAF50' },
    { value: 'symbol' as StylemapCategory, label: t('categories.symbol', 'Symbol Map'), color: '#2196F3' },
    { value: 'heatmap' as StylemapCategory, label: t('categories.heatmap', 'Heat Map'), color: '#FF5722' },
    { value: 'cluster' as StylemapCategory, label: t('categories.cluster', 'Cluster Map'), color: '#9C27B0' },
    { value: 'graduated' as StylemapCategory, label: t('categories.graduated', 'Graduated Symbols'), color: '#FF9800' },
    { value: 'categorized' as StylemapCategory, label: t('categories.categorized', 'Categorized Map'), color: '#607D8B' },
    { value: 'terrain' as StylemapCategory, label: t('categories.terrain', 'Terrain Visualization'), color: '#8BC34A' },
    { value: 'network' as StylemapCategory, label: t('categories.network', 'Network Map'), color: '#E91E63' },
    { value: 'flow' as StylemapCategory, label: t('categories.flow', 'Flow Map'), color: '#00BCD4' },
    { value: 'custom' as StylemapCategory, label: t('categories.custom', 'Custom Style'), color: '#795548' }
  ];

  // スタイルタイプオプション
  const styleTypeOptions = [
    { value: 'point' as const, label: t('styleTypes.point', 'Point Style') },
    { value: 'line' as const, label: t('styleTypes.line', 'Line Style') },
    { value: 'polygon' as const, label: t('styleTypes.polygon', 'Polygon Style') },
    { value: 'raster' as const, label: t('styleTypes.raster', 'Raster Style') }
  ];

  // カラースキームオプション
  const colorSchemeOptions = [
    { value: 'viridis', label: t('colorSchemes.viridis', 'Viridis') },
    { value: 'plasma', label: t('colorSchemes.plasma', 'Plasma') },
    { value: 'inferno', label: t('colorSchemes.inferno', 'Inferno') },
    { value: 'magma', label: t('colorSchemes.magma', 'Magma') },
    { value: 'turbo', label: t('colorSchemes.turbo', 'Turbo') },
    { value: 'spectral', label: t('colorSchemes.spectral', 'Spectral') },
    { value: 'rdylbu', label: t('colorSchemes.rdylbu', 'RdYlBu') },
    { value: 'custom', label: t('colorSchemes.custom', 'Custom Colors') }
  ];

  const handleInputChange = (field: keyof StylemapBasicInfoData, value: any) => {
    const updatedData = { ...localData, [field]: value };
    setLocalData(updatedData);
    onNext(updatedData);
  };

  const handleTagsChange = (newTags: TagEntity[]) => {
    const tagIds = newTags.map(tag => tag.id);
    handleInputChange('tags', tagIds);
  };

  const handleCategoryChange = (category: StylemapCategory | undefined) => {
    handleInputChange('category', category);
  };

  // エラーメッセージの取得
  const getFieldError = (field: string): string | undefined => {
    return errors.find(error => error.toLowerCase().includes(field.toLowerCase()));
  };

  // NOTE: name/description errors are handled by BasicInfoFields; omit unused locals to satisfy DTS
  const categoryError = getFieldError('category');
  const styleTypeError = getFieldError('styleType');

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('basicInfo.title', 'Basic Information')}
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('basicInfo.description', 'Enter the basic information for your styler. This will help organize and identify your map style configuration.')}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <BasicInfoFields
            value={{ name: localData.name, description: localData.description }}
            onChange={(updates) => {
              if (updates.name !== undefined) handleInputChange('name', updates.name);
              if (updates.description !== undefined) handleInputChange('description', updates.description);
            }}
            disabled={disabled}
            nameLabel={tStr('basicInfo.name.label', 'Stylemap Name')}
            nameHelperText={tStr('basicInfo.name.hint', 'Enter a descriptive name for this styler')}
            nameRequiredText={tStr('basicInfo.name.required', 'Stylemap name is required')}
            descriptionLabel={tStr('basicInfo.description.label', 'Description')}
            descriptionHelperText={tStr('basicInfo.description.hint', 'Optional description of what this styler visualizes')}
          />
        </Grid>

        {/* スタイルタイプ */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required error={!!styleTypeError}>
            <InputLabel>{t('basicInfo.styleType.label', 'Style Type')}</InputLabel>
            <Select
              value={localData.styleType}
              label={t('basicInfo.styleType.label', 'Style Type')}
              onChange={(e) => handleInputChange('styleType', e.target.value)}
              disabled={disabled}
            >
              {styleTypeOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {styleTypeError || t('basicInfo.styleType.hint', 'Choose the geometry type for this style')}
            </FormHelperText>
          </FormControl>
        </Grid>

        {/* カラースキーム */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>{t('basicInfo.colorScheme.label', 'Color Scheme')}</InputLabel>
            <Select
              value={localData.colorScheme || ''}
              label={t('basicInfo.colorScheme.label', 'Color Scheme')}
              onChange={(e) => handleInputChange('colorScheme', e.target.value)}
              disabled={disabled}
            >
              <MenuItem value="">
                <em>{t('basicInfo.colorScheme.none', 'None selected')}</em>
              </MenuItem>
              {colorSchemeOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {t('basicInfo.colorScheme.hint', 'Optional predefined color palette')}
            </FormHelperText>
          </FormControl>
        </Grid>

        {/* データソース */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label={t('basicInfo.dataSource.label', 'Data Source')}
            value={localData.dataSource || ''}
            onChange={(e) => handleInputChange('dataSource', e.target.value)}
            helperText={t('basicInfo.dataSource.hint', 'Optional reference to the data source or layer')}
            disabled={disabled}
            placeholder={tStr('basicInfo.dataSource.placeholder', 'e.g., Census data, OpenStreetMap layers')}
          />
        </Grid>

        {/* カテゴリ選択 */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            {t('basicInfo.category.label', 'Category')}
          </Typography>
          {React.createElement(CategorySelector as any, {
            options: categoryOptions,
            selectedCategory: localData.category,
            onCategoryChange: handleCategoryChange,
            placeholder: t('basicInfo.category.placeholder', 'Select a styler category'),
            disabled,
          })}
          {categoryError && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
              {categoryError}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {t('basicInfo.category.hint', 'Choose a category that best describes this styler type')}
          </Typography>
        </Grid>

        {/* タグ入力 */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            {t('basicInfo.tags.label', 'Tags')}
          </Typography>
          {React.createElement(TagInput as any, {
            selectedTags: localData.tags,
            onTagsChange: handleTagsChange,
            placeholder: t('basicInfo.tags.placeholder', 'Add tags to help organize and search...'),
            disabled,
            maxTags: 20,
            suggestionLimit: 10,
          })}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {t('basicInfo.tags.hint', 'Add tags to make this styler easier to find and organize')}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};

BasicInfoStep.displayName = 'StylemapBasicInfoStep';
