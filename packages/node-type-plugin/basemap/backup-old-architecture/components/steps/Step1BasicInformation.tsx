/**
 * @file Step1BasicInformation.tsx
 * @description Basic information step for BaseMap creation
 */

import React from 'react';
import {
  Box,
  Typography,
  TextField,
} from '@mui/material';

export interface Step1BasicInformationProps {
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  nameError?: string;
  descriptionError?: string;
}

export const Step1BasicInformation: React.FC<Step1BasicInformationProps> = ({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  nameError,
  descriptionError,
}) => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Map Information
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Provide basic information about your base map configuration.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          fullWidth
          label="Map Name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          error={!!nameError}
          helperText={nameError || 'Enter a descriptive name for this base map'}
          placeholder="e.g., Tokyo Street Map"
          required
        />

        <TextField
          fullWidth
          label="Description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          error={!!descriptionError}
          helperText={descriptionError || 'Optional description explaining the purpose of this map'}
          placeholder="e.g., Main street map for Tokyo area visualization"
          multiline
          rows={3}
        />
      </Box>
    </Box>
  );
};