import React from 'react';
import { Box, TextField, Typography, Stack } from '@mui/material';
import type { StepProps } from '~/types';

/**
 * Step 1: Basic Information
 * Collects name and description for the shape configuration
 */
export const Step1BasicInfo: React.FC<StepProps> = ({ workingCopy, onUpdate, disabled }) => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Basic Information
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Provide basic information for this geographic data configuration.
      </Typography>
      
      <Stack spacing={3}>
        <TextField
          label="Name"
          value={workingCopy.name || ''}
          onChange={(e) => onUpdate({ name: e.target.value })}
          required
          fullWidth
          disabled={disabled}
          error={!workingCopy.name}
          helperText={
            !workingCopy.name 
              ? 'Name is required' 
              : 'Enter a descriptive name for this configuration'
          }
          inputProps={{ maxLength: 100 }}
        />
        
        <TextField
          label="Description"
          value={workingCopy.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          multiline
          rows={3}
          fullWidth
          disabled={disabled}
          helperText="Optional description of this geographic data configuration"
          inputProps={{ maxLength: 500 }}
        />
      </Stack>
    </Box>
  );
};