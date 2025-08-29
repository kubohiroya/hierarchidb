import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  OutlinedInput,
  FormHelperText,
} from '@mui/material';
import type { PropertyResolverWorkingCopyEntity } from '~/types';

interface PropertyResolverBasicInfoStepProps {
  data: Partial<PropertyResolverWorkingCopyEntity>;
  onUpdate: (updates: Partial<PropertyResolverWorkingCopyEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export const PropertyResolverBasicInfoStep: React.FC<PropertyResolverBasicInfoStepProps> = ({
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

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value;
    onUpdate({ name });
    validateName(name);
  };

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const description = event.target.value;
    onUpdate({ description });
    validateDescription(description);
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
        <FormControl fullWidth error={!!nameError}>
          <InputLabel htmlFor="name-input">Name *</InputLabel>
          <OutlinedInput
            id="name-input"
            value={data.name || ''}
            onChange={handleNameChange}
            label="Name *"
            placeholder="Enter a descriptive name for this property resolver"
          />
          {nameError && <FormHelperText>{nameError}</FormHelperText>}
        </FormControl>

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Description"
          value={data.description || ''}
          onChange={handleDescriptionChange}
          placeholder="Optional description of what this property resolver does and how it's used"
          error={!!descriptionError}
          helperText={descriptionError || 'Optional detailed description'}
        />

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