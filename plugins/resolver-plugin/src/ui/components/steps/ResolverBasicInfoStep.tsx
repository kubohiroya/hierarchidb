import React, { useCallback, useEffect } from 'react';
import { Box, FormHelperText, Typography } from '@mui/material';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import type { ResolverWorkingCopyEntity } from '../../../common/types/index.js';

interface ResolverBasicInfoStepProps {
  data: Partial<ResolverWorkingCopyEntity>;
  onUpdate: (updates: Partial<ResolverWorkingCopyEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  mode: 'create' | 'edit';
}

export const ResolverBasicInfoStep: React.FC<ResolverBasicInfoStepProps> = ({
                                                                              data,
                                                                              onUpdate,
                                                                              onValidationChange,
                                                                              mode,
                                                                            }) => {
  const validateStep = useCallback(() => {
    const name = data.name ?? '';
    if (!name.trim() || name.length > 100) return false;
    if (data.description && data.description.length > 500) return false;
    return true;
  }, [data.description, data.name]);

  useEffect(() => {
    const isValid = validateStep();
    onValidationChange(isValid);
  }, [data.name, data.description, onValidationChange, validateStep]);

  const handleBasicChange = (value: BasicInfoData) => {
    onUpdate({
      name: value.name,
      description: value.description,
      tags: value.tags,
    });
  };

  return (
    <Box sx={{ maxWidth: 600 }}>
      <Typography variant="h6" gutterBottom>
        Basic Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Provide basic information for your property resolver configuration.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SharedBasicInfoStep
          name={data.name ?? ''}
          description={data.description ?? ''}
          tags={data.tags ?? []}
          mode={mode}
          onChange={handleBasicChange}
          validate={({ name, description }) => {
            if (!name.trim()) return 'Name is required';
            if (name.length > 100) return 'Name must be 100 characters or less';
            if (description && description.length > 500) return 'Description must be 500 characters or less';
            return null;
          }}
        />
        <FormHelperText error={!validateStep()}>
          {!validateStep() ? 'Name is required and description must be under 500 characters.' : ' '}
        </FormHelperText>

        <Box sx={{ mt: 2, p: 2, bgcolor: 'info.main', color: 'info.contrastText', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            What is Property Resolver?
          </Typography>
          <Typography variant="body2">
            Property Resolver allows you to create mapping rules between different data schemas.
            It's useful when you need to transform data properties from one format to another,
            validate data integrity, handle duplicates, and preview the mapping results.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
