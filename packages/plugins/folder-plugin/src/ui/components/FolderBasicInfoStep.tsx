/**
  * FolderBasicInfoStep Component
 * Step1
  */

import type React from 'react';
import { useCallback } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { Folder as FolderIcon, LocalOffer } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { TagId } from '@hierarchidb/common-types';
import { TagInput } from './TagInput.js';
import { BasicInfoFields } from '@hierarchidb/ui-core';

// TagId is a local branded string type

export interface FolderBasicInfoStepProps {
  workingCopy: { name?: string; description?: string; tags?: TagId[] };
  onUpdate: (updates: Partial<FolderBasicInfoStepProps['workingCopy']>) => void;
  disabled?: boolean;
}

/**
     */
export const FolderBasicInfoStep: React.FC<FolderBasicInfoStepProps> = ({ workingCopy, onUpdate, disabled = false }) => {
  const { t } = useTranslation('folderPlugin');

  const translate = useCallback(
    (key: string, fallback: string): string => {
      const value = t(key, { defaultValue: fallback }) as unknown;
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.join('');
      return fallback;
    },
    [t],
  );

  const handleTagChange = (tags: TagId[]) => {
    onUpdate({ tags });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
      {/*
*/}
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <FolderIcon color="primary" />
        <Typography variant="h6">{translate('basicInfo.title', 'Basic Information')}</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" paragraph>
        {translate(
          'basicInfo.description',
          'Enter basic folder information. Use tags to categorize and make folders easy to search.',
        )}
      </Typography>

      <Stack spacing={3}>
        <BasicInfoFields
          value={{ name: workingCopy.name, description: workingCopy.description }}
          onChange={onUpdate}
          disabled={disabled}
          nameLabel={translate('basicInfo.name.label', 'Folder Name')}
          nameHelperText={translate('basicInfo.name.helper', 'Enter a descriptive folder name')}
          nameRequiredText={translate('basicInfo.name.required', 'Folder name is required')}
          namePlaceholder={translate('basicInfo.name.placeholder', 'Enter folder name')}
          descriptionLabel={translate('basicInfo.description.label', 'Description')}
          descriptionHelperText={translate(
            'basicInfo.description.helper',
            'Describe the purpose or contents of this folder (optional)',
          )}
          descriptionPlaceholder={translate('basicInfo.description.placeholder', 'Enter description (optional)')}
        />

        <Divider />

        {/*
*/}
        <Box>
          <LocalOffer/>
          <TagInput
            value={workingCopy.tags || []}
            onChange={handleTagChange}
            placeholder={translate('basicInfo.tags.placeholder', 'Enter or select tags...')}
            label={translate('basicInfo.tags.label', 'Tags')}
            helperText={translate('basicInfo.tags.helper', 'Add tags to categorize this folder')}
            maxTags={10}
            allowCreate={true}
            disabled={disabled}
          />
        </Box>
      </Stack>

      {/*
*/}
      <Box mt={4} p={2} bgcolor="grey.50" borderRadius={1}>
        <Typography variant="caption" color="text.secondary">
          💡 <strong>{translate('basicInfo.hint.title', 'Tip:')}</strong>{' '}
          {translate(
            'basicInfo.hint.content',
            'Using tags makes it easy to search and organize folders. Examples: "Project", "Important", "Archive", etc.',
          )}
        </Typography>
      </Box>
    </Box>
  );
};
