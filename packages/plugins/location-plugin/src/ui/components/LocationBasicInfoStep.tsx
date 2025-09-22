/**
  * Location Basic Info Step Component
   */

import React from 'react';
import { Box, Divider, Stack, TextField, Typography } from '@mui/material';
import { LocationOn as LocationIcon } from '@mui/icons-material';
import type { LocationCategory, LocationWorkingCopy, TagId } from '../../types/index.js';
import { useTranslation } from '../../i18n/index.js';
import { BasicInfoFields } from '@hierarchidb/ui-core';

export interface LocationBasicInfoStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate: (updates: Partial<LocationWorkingCopy>) => void;
  disabled?: boolean;
}

/**
     */
export const LocationBasicInfoStep: React.FC<LocationBasicInfoStepProps> = ({
                                                                              workingCopy,
                                                                              onUpdate,
                                                                              disabled = false,
                                                                            }) => {
  const { translations } = useTranslation();
  const handleTagChange = (tags: TagId[]) => {
    onUpdate({
      tags,
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    });
  };

  const handleCategoryChange = (category: LocationCategory) => {
    onUpdate({
      category,
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    });
  };

  const handleNameChange = (name: string) => {
    onUpdate({
      name,
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    });
  };

  const handleDescriptionChange = (description: string) => {
    onUpdate({
      description,
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
      {/*
*/}
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <LocationIcon color="primary" />
        <Typography variant="h6">{translations.basicInfo.title}</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" paragraph>
        {translations.basicInfo.subtitle}
      </Typography>

      <Stack spacing={3}>
        <BasicInfoFields
          value={{ name: workingCopy.name, description: workingCopy.description }}
          onChange={(updates) => {
            if (updates.name !== undefined) handleNameChange(updates.name);
            if (updates.description !== undefined) handleDescriptionChange(updates.description);
          }}
          disabled={disabled}
          nameLabel={translations.basicInfo.nameLabel}
          nameHelperText={translations.basicInfo.nameHelperText}
          nameRequiredText={translations.errors?.nameRequired ?? translations.basicInfo.nameRequired}
          descriptionLabel={translations.basicInfo.descriptionLabel}
          descriptionHelperText={translations.basicInfo.descriptionHelperText}
        />

        <Divider />

        {/*
*/}
        <TextField
          select
          label={translations.basicInfo.categoryLabel}
          value={workingCopy.category || 'transportation'}
          onChange={(e) => handleCategoryChange(e.target.value as LocationCategory)}
          fullWidth
          disabled={disabled}
          helperText={translations.basicInfo.categoryHelperText}
          SelectProps={{
            native: true,
          }}
        >
          <option value="transportation">{translations.categories.transportation}</option>
          <option value="administrative">{translations.categories.administrative}</option>
          <option value="infrastructure">{translations.categories.infrastructure}</option>
        </TextField>

        {/*
*/}
        <TextField
          label={translations.basicInfo.tagsLabel}
          value={(workingCopy.tags || []).join(', ')}
          onChange={(e) => {
            const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) as TagId[];
            handleTagChange(tags);
          }}
          fullWidth
          disabled={disabled}
          helperText={translations.basicInfo.tagsHelperText}
          placeholder={translations.basicInfo.tagsPlaceholder}
        />
      </Stack>

      {/*
*/}
      <Box mt={4} p={2} bgcolor="grey.50" borderRadius={1}>
        <Typography variant="caption" color="text.secondary">
          {translations.basicInfo.hint}
        </Typography>
      </Box>
    </Box>
  );
};
