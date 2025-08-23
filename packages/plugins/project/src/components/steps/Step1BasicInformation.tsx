/**
 * Project Dialog - Step 1: Basic Information
 * Project name and description input
 */

import React, { useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  Card,
  CardContent,
  FormHelperText,
} from '@mui/material';
import type { CreateProjectData } from '../../types';

/**
 * Props for Step1BasicInformation
 */
export interface Step1BasicInformationProps {
  data: Partial<CreateProjectData>;
  onChange: (updates: Partial<CreateProjectData>) => void;
}

/**
 * Step 1: Basic Information Component
 */
export const Step1BasicInformation: React.FC<Step1BasicInformationProps> = ({
  data,
  onChange,
}) => {
  /**
   * Handle name change
   */
  const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value;
    onChange({ name });
  }, [onChange]);

  /**
   * Handle description change
   */
  const handleDescriptionChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const description = event.target.value;
    onChange({ description });
  }, [onChange]);

  /**
   * Validate project name
   */
  const nameError = React.useMemo(() => {
    if (!data.name) return 'Project name is required';
    if (data.name.length > 255) return 'Project name must be 255 characters or less';
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(data.name)) {
      return 'Project name can only contain letters, numbers, spaces, hyphens, and underscores';
    }
    return '';
  }, [data.name]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Project Information
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Provide basic information about your project. This will help identify and organize your map project.
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Box display="flex" flexDirection="column" gap={3}>
            {/* Project Name */}
            <Box>
              <TextField
                label="Project Name"
                value={data.name || ''}
                onChange={handleNameChange}
                fullWidth
                required
                error={Boolean(nameError)}
                helperText={nameError || 'Enter a descriptive name for your project'}
                placeholder="e.g., Regional Population Analysis"
                inputProps={{
                  maxLength: 255,
                }}
              />
            </Box>

            {/* Project Description */}
            <Box>
              <TextField
                label="Description"
                value={data.description || ''}
                onChange={handleDescriptionChange}
                fullWidth
                multiline
                rows={4}
                placeholder="Describe the purpose and scope of this project..."
                helperText="Optional: Provide additional context about your project"
                inputProps={{
                  maxLength: 1000,
                }}
              />
              <FormHelperText>
                {(data.description || '').length}/1000 characters
              </FormHelperText>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Additional Guidelines */}
      <Box mt={3}>
        <Typography variant="subtitle2" gutterBottom>
          Guidelines:
        </Typography>
        <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
          <li>Choose a clear, descriptive name that reflects your project's purpose</li>
          <li>Use the description to explain what data sources you'll be visualizing</li>
          <li>Consider including the geographic region or time period in your description</li>
        </Typography>
      </Box>
    </Box>
  );
};

export default Step1BasicInformation;