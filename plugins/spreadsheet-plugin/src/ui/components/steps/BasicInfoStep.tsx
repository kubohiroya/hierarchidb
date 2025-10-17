/**
 * @file BasicInfoStep.tsx
 * @description Basic Information step component for Spreadsheet plugin
 * Includes name, description, tags, and category selection
 */

import { Box, Divider, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { BasicInfoFields, TagChipsInput } from '@hierarchidb/runtime-basic-info';
import type { FC } from 'react';

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

  const handleUpdate = (updates: Partial<typeof data>) => {
    onNext({
      ...data,
      ...updates,
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
        <BasicInfoFields
          value={{ name: data.name, description: data.description }}
          onChange={(updates: Partial<{ name: string; description: string }>) => handleUpdate(updates)}
          disabled={disabled}
          nameLabel={String(t('basicInfo.name.label', 'Spreadsheet Name'))}
          nameHelperText={String(t('basicInfo.name.helper', 'Enter a descriptive name for this spreadsheet'))}
          nameRequiredText={String(t('basicInfo.name.required', 'Spreadsheet name is required'))}
          descriptionLabel={String(t('basicInfo.description.label', 'Description'))}
          descriptionHelperText={String(t('basicInfo.description.helper', 'Describe the purpose or contents of this spreadsheet (optional)'))}
        />

        <Divider />

        <Box>
          <TagChipsInput
            value={data.tags ?? []}
            onChange={(tags: string[]) => handleUpdate({ tags })}
            placeholder={String(t('basicInfo.tags.placeholder', 'Type a tag and press Enter'))}
            label={String(t('basicInfo.tags.label', 'Tags'))}
            helperText={String(t('basicInfo.tags.helper', 'Add tags to categorize and organize this spreadsheet'))}
            disabled={disabled}
          />
        </Box>

        {/*
 PRTagInput
*/}
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
