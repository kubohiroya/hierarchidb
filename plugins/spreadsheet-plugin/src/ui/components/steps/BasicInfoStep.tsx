/**
 * @file BasicInfoStep.tsx
 * @description Basic Information step component for Spreadsheet plugin
 * Includes name, description, tags, and category selection
 */

import { Box, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { FC } from 'react';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';

export interface BasicInfoStepProps {
  data: {
    name?: string;
    description?: string;
    tags?: string[];
  };
  onNext: (data: any) => void;
  onPrevious?: () => void;
  errors?: string[];
  disabled?: boolean;
}

/**
    */
export const BasicInfoStep: FC<BasicInfoStepProps> = ({
  data,
  onNext,
  disabled = false,
}) => {
  const { t } = useTranslation('spreadsheet-plugin');

  const handleUpdate = (updates: BasicInfoData) => {
    onNext({
      ...data,
      name: updates.name,
      description: updates.description,
      tags: updates.tags,
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
      {/*
*/}
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <Typography variant="h6">📄 {String(t('basicInfo.title', 'Basic Information'))}</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" paragraph>
        {String(t('basicInfo.description', 'Configure the basic settings for your spreadsheet. Add tags and categories to organize and find your data easily.'))}
      </Typography>

      <Stack spacing={3}>
        <SharedBasicInfoStep
          name={data.name ?? ''}
          description={data.description ?? ''}
          tags={data.tags ?? []}
          onChange={handleUpdate}
          mode="create"
          disabled={disabled}
          validate={(value) => (value.name.trim().length ? null : String(t('basicInfo.name.required', 'Spreadsheet name is required')))}
        />
      </Stack>

      {/*
*/}
      <Box mt={4} p={2} bgcolor="grey.50" borderRadius={1}>
        <Typography variant="caption" color="text.secondary">
          📊 <strong>{String(t('basicInfo.hint.title', 'Tip:'))}</strong>{' '}
          {String(t('basicInfo.hint.content', 'Use categories and tags to organize your spreadsheets. Examples: "Sales Data", "Budget", "Analysis", etc.'))}
        </Typography>
      </Box>
    </Box>
  );
};
