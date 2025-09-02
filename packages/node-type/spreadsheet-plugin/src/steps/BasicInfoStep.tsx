/**
 * @file BasicInfoStep.tsx
 * @description Basic Information step component for Spreadsheet plugin
 * Includes name, description, tags, and category selection
 */

import React from 'react';
import { 
  Box, 
  TextField, 
  Typography, 
  Stack, 
  Divider 
} from '@mui/material';
import { TableChart as TableIcon } from '@mui/icons-material';
import { useTranslation } from 'provider-i18next';
import type { TagId } from '@hierarchidb/common-type';
import { TagInput } from '@hierarchidb/folder-plugin';
import { CategorySelector } from '@hierarchidb/folder-plugin';
import type { SpreadsheetCategory } from '../types/category-types';

export interface BasicInfoStepProps {
  data: {
    name?: string;
    description?: string;
    tags?: TagId[];
    category?: SpreadsheetCategory;
  };
  onNext: (data: any) => void;
  onPrevious?: () => void;
  errors?: string[];
  disabled?: boolean;
}

/**
 * スプレッドシートの基本情報入力コンポーネント
 */
export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  data,
  onNext,
  errors = [],
  disabled = false
}) => {
  const { t } = useTranslation('spreadsheet-plugin');
  
  const categoryOptions = [
    { value: 'data-analysis' as SpreadsheetCategory, label: t('categories.dataAnalysis', 'Data Analysis'), color: '#4CAF50' },
    { value: 'financial' as SpreadsheetCategory, label: t('categories.financial', 'Financial'), color: '#2196F3' },
    { value: 'inventory' as SpreadsheetCategory, label: t('categories.inventory', 'Inventory'), color: '#FF9800' },
    { value: 'reporting' as SpreadsheetCategory, label: t('categories.reporting', 'Reporting'), color: '#9C27B0' },
    { value: 'dashboard' as SpreadsheetCategory, label: t('categories.dashboard', 'Dashboard'), color: '#F44336' },
    { value: 'template' as SpreadsheetCategory, label: t('categories.template', 'Template'), color: '#795548' }
  ];

  const handleUpdate = (updates: Partial<typeof data>) => {
    onNext({
      ...data,
      ...updates
    });
  };

  const handleTagChange = (tags: TagId[]) => {
    handleUpdate({ tags });
  };

  const handleCategoryChange = (category: SpreadsheetCategory | undefined) => {
    handleUpdate({ category });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
      {/* セクションヘッダー */}
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <TableIcon color="primary" />
        <Typography variant="h6">{t('basicInfo.title', 'Basic Information')}</Typography>
      </Box>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('basicInfo.description', 'Configure the basic settings for your spreadsheet. Add tags and categories to organize and find your data easily.')}
      </Typography>

      <Stack spacing={3}>
        {/* 名前入力 */}
        <TextField
          label={t('basicInfo.name.label', 'Spreadsheet Name')}
          value={data.name || ''}
          onChange={(e) => handleUpdate({ name: e.target.value })}
          required
          fullWidth
          disabled={disabled}
          error={!data.name}
          helperText={
            !data.name 
              ? t('basicInfo.name.required', 'Spreadsheet name is required') 
              : t('basicInfo.name.helper', 'Enter a descriptive name for this spreadsheet')
          }
          inputProps={{ maxLength: 100 }}
          variant="outlined"
        />

        {/* 説明入力 */}
        <TextField
          label={t('basicInfo.description.label', 'Description')}
          value={data.description || ''}
          onChange={(e) => handleUpdate({ description: e.target.value })}
          multiline
          rows={3}
          fullWidth
          disabled={disabled}
          helperText={t('basicInfo.description.helper', 'Describe the purpose or contents of this spreadsheet (optional)')}
          inputProps={{ maxLength: 500 }}
          variant="outlined"
        />

        <Divider />

        {/* カテゴリ選択 */}
        <CategorySelector<SpreadsheetCategory>
          label={t('basicInfo.category.label', 'Category')}
          value={data.category}
          onChange={handleCategoryChange}
          options={categoryOptions}
          helperText={t('basicInfo.category.helper', 'Select a category that best describes this spreadsheet')}
          disabled={disabled}
        />

        {/* タグ入力セクション */}
        <Box>
          <TagInput
            value={data.tags || []}
            onChange={handleTagChange}
            placeholder={t('basicInfo.tags.placeholder', 'Enter or select tags...')}
            label={t('basicInfo.tags.label', 'Tags')}
            helperText={t('basicInfo.tags.helper', 'Add tags to categorize and organize this spreadsheet')}
            maxTags={10}
            allowCreate={true}
            disabled={disabled}
          />
        </Box>
      </Stack>

      {/* フォーム下部の情報表示 */}
      <Box mt={4} p={2} bgcolor="grey.50" borderRadius={1}>
        <Typography variant="caption" color="text.secondary">
          📊 <strong>{t('basicInfo.hint.title', 'Tip:')}</strong>{' '}
          {t('basicInfo.hint.content', 'Use categories and tags to organize your spreadsheets. Examples: "Sales Data", "Budget", "Analysis", etc.')}
        </Typography>
      </Box>
    </Box>
  );
};
