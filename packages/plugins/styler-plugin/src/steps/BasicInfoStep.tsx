import React, { useState } from 'react';
import { Box, FormControl, FormHelperText, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { useTranslation } from 'react-i18next';
import { BasicInfoFields, CategorySelector, TagInput } from '@hierarchidb/ui-core';
import type { StylemapCategory, StylemapCategoryConfig } from '../types/category-types.js';

type TagId = string;
type TagEntity = { id: TagId; name?: string };

/**
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
    */
export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
                                                              data,
                                                              onNext,
                                                              errors = [],
                                                              disabled = false,
                                                            }) => {
  const { t } = useTranslation('styler-plugin');
  const tStr = (key: string, def: string): string => {
    const val = t(key, { defaultValue: def });
    return typeof val === 'string' ? val : def;
  };
  const [localData, setLocalData] = useState<StylemapBasicInfoData>(data);

  //  i18n
  const categoryOptions: StylemapCategoryConfig[] = [
    { value: 'choropleth' as StylemapCategory, label: tStr('categories.choropleth', 'Choropleth Map'), color: '#4CAF50' },
    { value: 'symbol' as StylemapCategory, label: tStr('categories.symbol', 'Symbol Map'), color: '#2196F3' },
    { value: 'heatmap' as StylemapCategory, label: tStr('categories.heatmap', 'Heat Map'), color: '#FF5722' },
    { value: 'cluster' as StylemapCategory, label: tStr('categories.cluster', 'Cluster Map'), color: '#9C27B0' },
    { value: 'graduated' as StylemapCategory, label: tStr('categories.graduated', 'Graduated Symbols'), color: '#FF9800' },
    {
      value: 'categorized' as StylemapCategory,
      label: tStr('categories.categorized', 'Categorized Map'),
      color: '#607D8B',
    },
    { value: 'terrain' as StylemapCategory, label: tStr('categories.terrain', 'Terrain Visualization'), color: '#8BC34A' },
    { value: 'network' as StylemapCategory, label: tStr('categories.network', 'Network Map'), color: '#E91E63' },
    { value: 'flow' as StylemapCategory, label: tStr('categories.flow', 'Flow Map'), color: '#00BCD4' },
    { value: 'custom' as StylemapCategory, label: tStr('categories.custom', 'Custom Style'), color: '#795548' },
  ];

  const styleTypeOptions = [
    { value: 'point' as const, label: tStr('styleTypes.point', 'Point Style') },
    { value: 'line' as const, label: tStr('styleTypes.line', 'Line Style') },
    { value: 'polygon' as const, label: tStr('styleTypes.polygon', 'Polygon Style') },
    { value: 'raster' as const, label: tStr('styleTypes.raster', 'Raster Style') },
  ];

  const colorSchemeOptions = [
    { value: 'viridis', label: tStr('colorSchemes.viridis', 'Viridis') },
    { value: 'plasma', label: tStr('colorSchemes.plasma', 'Plasma') },
    { value: 'inferno', label: tStr('colorSchemes.inferno', 'Inferno') },
    { value: 'magma', label: tStr('colorSchemes.magma', 'Magma') },
    { value: 'turbo', label: tStr('colorSchemes.turbo', 'Turbo') },
    { value: 'spectral', label: tStr('colorSchemes.spectral', 'Spectral') },
    { value: 'rdylbu', label: tStr('colorSchemes.rdylbu', 'RdYlBu') },
    { value: 'custom', label: tStr('colorSchemes.custom', 'Custom Colors') },
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

  const getFieldError = (field: string): string | undefined => {
    return errors.find(error => error.toLowerCase().includes(field.toLowerCase()));
  };

  // NOTE: name/description errors are handled by BasicInfoFields; omit unused locals to satisfy DTS
  const categoryError = getFieldError('category');
  const styleTypeError = getFieldError('styleType');

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {tStr('basicInfo.title', 'Basic Information')}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {tStr('basicInfo.description', 'Enter the basic information for your styler. This will help organize and identify your map style configuration.')}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <BasicInfoFields
            value={{ name: localData.name, description: localData.description }}
            onChange={(updates: Partial<{ name: string; description: string }>) => {
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

        {/*
*/}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required error={!!styleTypeError}>
            <InputLabel>{tStr('basicInfo.styleType.label', 'Style Type')}</InputLabel>
            <Select
              value={localData.styleType}
              label={tStr('basicInfo.styleType.label', 'Style Type')}
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
              {styleTypeError || tStr('basicInfo.styleType.hint', 'Choose the geometry type for this style')}
            </FormHelperText>
          </FormControl>
        </Grid>

        {/*
*/}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>{tStr('basicInfo.colorScheme.label', 'Color Scheme')}</InputLabel>
            <Select
              value={localData.colorScheme || ''}
              label={tStr('basicInfo.colorScheme.label', 'Color Scheme')}
              onChange={(e) => handleInputChange('colorScheme', e.target.value)}
              disabled={disabled}
            >
              <MenuItem value="">
                <em>{tStr('basicInfo.colorScheme.none', 'None selected')}</em>
              </MenuItem>
              {colorSchemeOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {tStr('basicInfo.colorScheme.hint', 'Optional predefined color palette')}
            </FormHelperText>
          </FormControl>
        </Grid>

        {/*
*/}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label={tStr('basicInfo.dataSource.label', 'Data Source')}
            value={localData.dataSource || ''}
            onChange={(e) => handleInputChange('dataSource', e.target.value)}
            helperText={tStr('basicInfo.dataSource.hint', 'Optional reference to the data source or layer')}
            disabled={disabled}
            placeholder={tStr('basicInfo.dataSource.placeholder', 'e.g., Census data, OpenStreetMap layers')}
          />
        </Grid>

        {/*
*/}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            {tStr('basicInfo.category.label', 'Category')}
          </Typography>
          <CategorySelector
            value={localData.category ?? ''}
            options={categoryOptions.map((option) => ({ value: option.value, label: option.label }))}
            placeholder={tStr('basicInfo.category.placeholder', 'Select a styler category')}
            onChange={(value) => {
              if (disabled) return;
              handleCategoryChange(value ? (value as StylemapCategory) : undefined);
            }}
          />
          {categoryError && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
              {categoryError}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {tStr('basicInfo.category.hint', 'Choose a category that best describes this styler type')}
          </Typography>
        </Grid>

        {/*
*/}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            {tStr('basicInfo.tags.label', 'Tags')}
          </Typography>
          <TagInput
            value={localData.tags.map((tagId) => ({ id: tagId, name: tagId }))}
            placeholder={tStr('basicInfo.tags.placeholder', 'Add tags to help organize and search...')}
            onChange={(updated) => {
              if (disabled) return;
              const tagEntities: TagEntity[] = updated.map((tag) => ({ id: tag.id, name: tag.name }));
              handleTagsChange(tagEntities);
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {tStr('basicInfo.tags.hint', 'Add tags to make this styler easier to find and organize')}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};

BasicInfoStep.displayName = 'StylemapBasicInfoStep';
