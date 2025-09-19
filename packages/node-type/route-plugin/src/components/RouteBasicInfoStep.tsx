/**
  * Route Basic Info Step Component
   */

import React, { useEffect } from 'react';
import {
  Box,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { BasicInfoFields } from '@hierarchidb/ui-core';
import { Route as RouteIcon } from '@mui/icons-material';
import type { RouteCategory, RouteWorkingCopy, TagId } from '../types/index.js';
import { RouteType, TransportMode } from '../types/index.js';
import { useTranslation } from '../i18n/index.js';

export interface RouteBasicInfoStepProps {
  workingCopy: RouteWorkingCopy;
  onUpdate: (updates: Partial<RouteWorkingCopy>) => void;
  onValidationChange: (isValid: boolean) => void;
  disabled?: boolean;
}

/**
    */
export const RouteBasicInfoStep: React.FC<RouteBasicInfoStepProps> = ({
                                                                        workingCopy,
                                                                        onUpdate,
                                                                        onValidationChange,
                                                                        disabled = false,
                                                                      }) => {
  const { translations } = useTranslation();

  // Validation logic
  useEffect(() => {
    const isValid =
      workingCopy.name.trim() !== '' &&
      workingCopy.routeType &&
      workingCopy.transportModes &&
      workingCopy.transportModes.length > 0;

    onValidationChange(isValid);
  }, [workingCopy.name, workingCopy.routeType, workingCopy.transportModes, onValidationChange]);

  const handleTagChange = (tags: TagId[]) => {
    onUpdate({
      tags,
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    });
  };

  const handleCategoryChange = (category: RouteCategory) => {
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

  const handleRouteTypeChange = (routeType: RouteType) => {
    onUpdate({
      routeType,
      routeTypes: [routeType],
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    });
  };

  const handleTransportModesChange = (event: SelectChangeEvent<TransportMode[]>) => {
    const value = event.target.value;
    const transportModes = typeof value === 'string' ? value.split(',') as TransportMode[] : value as TransportMode[];

    onUpdate({
      transportModes,
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 700, margin: '0 auto' }}>
      {/*
*/}
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <RouteIcon color="primary" />
        <Typography variant="h6">{translations.basicInfo.title}</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" paragraph>
        {translations.basicInfo.subtitle}
      </Typography>

      <Stack spacing={3}>
        <BasicInfoFields
          value={{ name: workingCopy.name, description: workingCopy.description }}
          onChange={(updates: Partial<RouteWorkingCopy>) => {
            if (updates.name !== undefined) handleNameChange(updates.name);
            if (updates.description !== undefined) handleDescriptionChange(updates.description);
          }}
          disabled={disabled}
          nameLabel={translations.basicInfo.nameLabel}
          nameHelperText={translations.basicInfo.nameHelperText}
          nameRequiredText={translations.errors.nameRequired}
          descriptionLabel={translations.basicInfo.descriptionLabel}
          descriptionHelperText={translations.basicInfo.descriptionHelperText}
        />

        <Divider />

        {/*
*/}
        <TextField
          select
          label={translations.basicInfo.routeTypeLabel}
          value={workingCopy.routeType}
          onChange={(e) => handleRouteTypeChange(e.target.value as RouteType)}
          required
          fullWidth
          disabled={disabled}
          helperText={translations.basicInfo.routeTypeHelperText}
          error={!workingCopy.routeType}
        >
          {Object.values(RouteType).map((type) => (
            <MenuItem key={type} value={type}>
              {translations.routeTypes[type]}
            </MenuItem>
          ))}
        </TextField>

        {/*
*/}
        <FormControl required fullWidth disabled={disabled}>
          <InputLabel>{translations.basicInfo.transportModesLabel}</InputLabel>
          <Select
            multiple
            value={workingCopy.transportModes || []}
            onChange={handleTransportModesChange}
            input={<OutlinedInput label={translations.basicInfo.transportModesLabel} />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((mode) => (
                  <Chip
                    key={mode}
                    label={translations.transportModes[mode]}
                    size="small"
                  />
                ))}
              </Box>
            )}
          >
            {Object.values(TransportMode).map((mode) => (
              <MenuItem key={mode} value={mode}>
                {translations.transportModes[mode]}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
            {translations.basicInfo.transportModesHelperText}
          </Typography>
        </FormControl>

        {/*
*/}
        <TextField
          select
          label={translations.basicInfo.categoryLabel}
          value={workingCopy.category || 'transportation'}
          onChange={(e) => handleCategoryChange(e.target.value as RouteCategory)}
          fullWidth
          disabled={disabled}
          helperText={translations.basicInfo.categoryHelperText}
          SelectProps={{
            native: true,
          }}
        >
          <option value="transportation">{translations.categories.transportation}</option>
          <option value="recreation">{translations.categories.recreation}</option>
          <option value="logistics">{translations.categories.logistics}</option>
          <option value="emergency">{translations.categories.emergency}</option>
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
