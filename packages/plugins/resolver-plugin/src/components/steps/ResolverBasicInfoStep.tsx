import React, { useEffect, useState } from 'react';
import { Box, FormHelperText, Typography } from '@mui/material';
import { BasicInfoFields } from '@hierarchidb/ui-core';
import type { ResolverWorkingCopyEntity } from '../../types/index.js';

interface ResolverBasicInfoStepProps {
  data: Partial<ResolverWorkingCopyEntity>;
  onUpdate: (updates: Partial<ResolverWorkingCopyEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export const ResolverBasicInfoStep: React.FC<ResolverBasicInfoStepProps> = ({
                                                                              data,
                                                                              onUpdate,
                                                                              onValidationChange,
                                                                            }) => {
  const [nameError, setNameError] = useState<string>('');
  const [descriptionError, setDescriptionError] = useState<string>('');

  const validateName = (name: string): boolean => {
    if (!name || name.trim().length === 0) {
      setNameError('Name is required');
      return false;
    }
    if (name.length > 100) {
      setNameError('Name must be 100 characters or less');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateDescription = (description: string): boolean => {
    if (description && description.length > 500) {
      setDescriptionError('Description must be 500 characters or less');
      return false;
    }
    setDescriptionError('');
    return true;
  };

  const validateStep = () => {
    const isNameValid = validateName(data.name || '');
    const isDescriptionValid = validateDescription(data.description || '');
    return isNameValid && isDescriptionValid;
  };

  useEffect(() => {
    const isValid = validateStep();
    onValidationChange(isValid);
  }, [data.name, data.description, onValidationChange]);

  const handleBasicChange = (updates: Partial<ResolverWorkingCopyEntity>) => {
    if (updates.name !== undefined) {
      onUpdate({ name: updates.name });
      validateName(updates.name || '');
    }
    if (updates.description !== undefined) {
      onUpdate({ description: updates.description });
      validateDescription(updates.description || '');
    }
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
        <BasicInfoFields
          value={{ name: data.name, description: data.description }}
          onChange={handleBasicChange}
          nameLabel={'Name'}
          nameRequiredText={'Name is required'}
          nameHelperText={'Enter a descriptive name for this property resolver'}
          descriptionLabel={'Description'}
          descriptionHelperText={'Optional detailed description'}
        />
        {(nameError || descriptionError) && (
          <FormHelperText error>{nameError || descriptionError}</FormHelperText>
        )}

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
