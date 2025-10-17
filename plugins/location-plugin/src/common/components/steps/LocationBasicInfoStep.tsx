/**
 * Location Basic Information Step
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { BasicInfoFields } from '@hierarchidb/runtime-basic-info';
import type { LocationWorkingCopy } from '../../types/index.js';
import { useTranslation } from '../../i18n/index.js';

interface LocationBasicInfoStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate: (updates: Partial<LocationWorkingCopy>) => void;
}

export const LocationBasicInfoStep: React.FC<LocationBasicInfoStepProps> = ({ workingCopy, onUpdate }) => {
  const { translations } = useTranslation();

  const { name, description, tags } = useMemo(() => {
    const draft = workingCopy.draft;
    return {
      name: draft.name ?? '',
      description: draft.description ?? '',
      tags: workingCopy.tags ?? [],
    };
  }, [workingCopy.draft, workingCopy.tags]);

  const handleBasicInfoChange = (updates: { name?: string; description?: string }) => {
    const draftPatch: Partial<LocationWorkingCopy['draft']> = {};
    if (updates.name !== undefined) {
      draftPatch.name = updates.name;
    }
    if (updates.description !== undefined) {
      draftPatch.description = updates.description;
    }
    if (Object.keys(draftPatch).length > 0) {
      onUpdate({ draft: draftPatch });
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <BasicInfoFields
        value={{ name, description }}
        onChange={handleBasicInfoChange}
        nameLabel={translations.basicInfo.nameLabel}
        nameHelperText={translations.basicInfo.nameHelperText}
        nameRequiredText={translations.errors.nameRequired}
        descriptionLabel={translations.basicInfo.descriptionLabel}
        descriptionHelperText={translations.basicInfo.descriptionHelperText}
      />

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          {translations.basicInfo.tagsLabel}
        </Typography>
        <TextField
          fullWidth
          value={tags.join(', ')}
          onChange={(event) => {
            const next = event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean);
            onUpdate({ tags: next });
          }}
          placeholder={translations.basicInfo.tagsPlaceholder}
          helperText={translations.basicInfo.tagsHelperText}
        />
      </Box>
    </Box>
  );
};
