import React, { useState } from 'react';
import { Box, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { BasicInfoFields } from '@hierarchidb/ui-core';
import { Business as BusinessIcon, Public as PublicIcon } from '@mui/icons-material';
import { AdapterDateFns, LocalizationProvider } from '@hierarchidb/ui-date';
import type { ProjectCategory, ProjectEntity } from '~/types/project-types';

interface BasicInfoStepProps {
  data: Partial<ProjectEntity>;
  onComplete: (data: Partial<ProjectEntity>) => void;
}

const categoryOptions: { value: ProjectCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'urban-planning', label: 'Urban Planning', icon: <BusinessIcon /> },
  { value: 'disaster-management', label: 'Disaster Management', icon: <PublicIcon /> },
  { value: 'tourism', label: 'Tourism', icon: <PublicIcon /> },
  { value: 'environment', label: 'Environment', icon: <PublicIcon /> },
  { value: 'infrastructure', label: 'Infrastructure', icon: <BusinessIcon /> },
  { value: 'research', label: 'Research', icon: <PublicIcon /> },
];

export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({ data }) => {
  const [formData, setFormData] = useState({
    name: data.name || '',
    description: data.description || '',
    category: data.category || ('research' as ProjectCategory),
    visibility: data.visibility || 'private',
    collaborators: data.collaborators || [],
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 2 }}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <BasicInfoFields
              value={{ name: formData.name, description: formData.description }}
              onChange={(updates: Partial<{ name: string; description: string }>) =>
                Object.entries(updates).forEach(([k, v]) => handleChange(k, v))
              }
              nameLabel={'Project Name'}
              nameHelperText={'Enter a descriptive project name'}
              nameRequiredText={'Project name is required'}
              descriptionLabel={'Description'}
              descriptionHelperText={'Optional description for the project'}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                label="Category"
              >
                {categoryOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {option.icon}
                      {option.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};
