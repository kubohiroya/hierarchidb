/**
 * Basic Information Step Component
 * Common first step for all plugin dialogs
 */

import React, { useCallback } from 'react';
import { Box, FormControl, FormHelperText, TextField, Typography } from '@mui/material';

export interface BasicInfoData {
  name: string;
  description: string;
}

export interface BasicInfoStepProps {
  /** Current name value */
  name: string;

  /** Current description value */
  description: string;

  /** Change handler */
  onChange: (data: BasicInfoData) => void;

  /** Dialog mode */
  mode: 'create' | 'edit';

  /** Optional custom validation */
  validate?: (data: BasicInfoData) => string | null;
}

/**
 * Basic Information Step Component
 */
export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
                                                              name,
                                                              description,
                                                              onChange,
                                                              mode,
                                                              validate,
                                                            }) => {
  // Handle name change
  const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      name: event.target.value,
      description,
    });
  }, [description, onChange]);

  // Handle description change
  const handleDescriptionChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      name,
      description: event.target.value,
    });
  }, [name, onChange]);

  // Validation
  const validationError = validate?.({ name, description });
  const nameError = !name.trim() ? 'Name is required' : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        {mode === 'create'
          ? 'Enter basic information for the new node.'
          : 'Update the basic information for this node.'}
      </Typography>

      <FormControl fullWidth error={!!nameError}>
        <TextField
          label="Name"
          value={name}
          onChange={handleNameChange}
          required
          autoFocus
          error={!!nameError}
          helperText={nameError}
          placeholder="Enter a descriptive name"
          variant="outlined"
          inputProps={{
            maxLength: 255,
          }}
        />
      </FormControl>

      <FormControl fullWidth>
        <TextField
          label="Description"
          value={description}
          onChange={handleDescriptionChange}
          multiline
          rows={4}
          placeholder="Enter an optional description"
          variant="outlined"
          helperText={`${description.length}/1000 characters`}
          inputProps={{
            maxLength: 1000,
          }}
        />
      </FormControl>

      {validationError && (
        <FormHelperText error>
          {validationError}
        </FormHelperText>
      )}

      <Typography variant="caption" color="text.secondary">
        * Required fields
      </Typography>
    </Box>
  );
};