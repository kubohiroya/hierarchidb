/**
 * Route Basic Info Step Component
 */

import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Route as RouteIcon } from '@mui/icons-material';
import type { RouteCategory, RouteEntity, RouteWorkingCopy, TagId } from '../types/index.js';
import { RouteType, TransportMode } from '../types/index.js';
import { getRouteDraft } from '../utils/workingCopy.js';
import { useTranslation } from '../i18n/index.js';
import { BasicInfoFields, type BasicInfoValue } from '@hierarchidb/ui-plugin-basic-info';

export interface RouteBasicInfoStepProps {
  workingCopy: RouteWorkingCopy;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  disabled?: boolean;
}

export const RouteBasicInfoStep: React.FC<RouteBasicInfoStepProps> = ({
  workingCopy,
  onUpdate,
  onValidationChange,
  disabled = false,
}) => {
  const { translations } = useTranslation();

  const draft = useMemo(() => getRouteDraft(workingCopy), [workingCopy]);
  const resolvedName = typeof draft.name === 'string' ? draft.name : '';
  const resolvedDescription = typeof draft.description === 'string' ? draft.description : '';
  const resolvedRouteType = draft.routeType ?? RouteType.ROAD;
  const resolvedTransportModes = useMemo(()=>draft.transportModes ?? [], [
    draft.transportModes,
  ]);
  const resolvedCategory = (draft.category as RouteCategory | undefined) ?? 'transportation';
  const resolvedTags = draft.tags ?? [];

  const computeNextVersion = useCallback(() => {
    const baseVersion = typeof draft.version === 'number'
      ? draft.version
      : typeof workingCopy.originalVersion === 'number'
        ? workingCopy.originalVersion
        : 0;
    return typeof baseVersion === 'number' ? baseVersion + 1 : 0;
  }, [draft.version, workingCopy.originalVersion]);

  const emitUpdate = useCallback((updates: Partial<RouteEntity>) => {
    onUpdate({
      ...updates,
      updatedAt: Date.now(),
      version: computeNextVersion(),
    });
  }, [computeNextVersion, onUpdate]);

  useEffect(() => {
    const isValid = Boolean(resolvedName.trim()) && Boolean(resolvedRouteType) && resolvedTransportModes.length > 0;
    onValidationChange(isValid);
  }, [onValidationChange, resolvedName, resolvedRouteType, resolvedTransportModes]);

  const handleTagChange = useCallback((tags: TagId[]) => {
    emitUpdate({ tags });
  }, [emitUpdate]);

  const handleCategoryChange = useCallback((category: RouteCategory) => {
    emitUpdate({ category });
  }, [emitUpdate]);

  const handleNameChange = useCallback((name: string) => {
    emitUpdate({ name });
  }, [emitUpdate]);

  const handleDescriptionChange = useCallback((description: string) => {
    emitUpdate({ description });
  }, [emitUpdate]);

  const handleRouteTypeChange = useCallback((routeType: RouteType) => {
    emitUpdate({ routeType });
  }, [emitUpdate]);

  const handleTransportModesChange = useCallback((event: SelectChangeEvent<TransportMode[]>) => {
    const value = event.target.value;
    const transportModes = typeof value === 'string'
      ? (value.split(',') as TransportMode[])
      : (value as TransportMode[]);
    emitUpdate({ transportModes });
  }, [emitUpdate]);

  return (
    <Box sx={{ p: 3, maxWidth: 700, margin: '0 auto' }}>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <RouteIcon color="primary" />
        <Typography variant="h6">{translations.basicInfo.title}</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" paragraph>
        {translations.basicInfo.subtitle}
      </Typography>

      <Stack spacing={3}>
        <BasicInfoFields
          value={{ name: resolvedName, description: resolvedDescription }}
          onChange={(updates: Partial<BasicInfoValue>) => {
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

        <TextField
          select
          label={translations.basicInfo.routeTypeLabel}
          value={resolvedRouteType ?? ''}
          onChange={(event) => handleRouteTypeChange(event.target.value as RouteType)}
          required
          fullWidth
          disabled={disabled}
          helperText={translations.basicInfo.routeTypeHelperText}
          error={!resolvedRouteType}
        >
          {Object.values(RouteType).map((type) => (
            <MenuItem key={type} value={type}>
              {translations.routeTypes[type]}
            </MenuItem>
          ))}
        </TextField>

        <FormControl required fullWidth disabled={disabled}>
          <InputLabel>{translations.basicInfo.transportModesLabel}</InputLabel>
          <Select
            multiple
            value={resolvedTransportModes}
            onChange={handleTransportModesChange}
            input={<OutlinedInput label={translations.basicInfo.transportModesLabel} />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((mode) => (
                  <Chip key={mode} label={translations.transportModes[mode]} size="small" />
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

        <TextField
          select
          label={translations.basicInfo.categoryLabel}
          value={resolvedCategory}
          onChange={(event) => handleCategoryChange(event.target.value as RouteCategory)}
          fullWidth
          disabled={disabled}
          helperText={translations.basicInfo.categoryHelperText}
          SelectProps={{ native: true }}
        >
          <option value="transportation">{translations.categories.transportation}</option>
          <option value="recreation">{translations.categories.recreation}</option>
          <option value="logistics">{translations.categories.logistics}</option>
          <option value="emergency">{translations.categories.emergency}</option>
        </TextField>

        <TextField
          label={translations.basicInfo.tagsLabel}
          value={resolvedTags.join(', ')}
          onChange={(event) => {
            const tags = event.target.value
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean) as TagId[];
            handleTagChange(tags);
          }}
          fullWidth
          disabled={disabled}
          helperText={translations.basicInfo.tagsHelperText}
          placeholder={translations.basicInfo.tagsPlaceholder}
        />
      </Stack>

      <Box mt={4} p={2} bgcolor="grey.50" borderRadius={1}>
        <Typography variant="caption" color="text.secondary">
          {translations.basicInfo.hint}
        </Typography>
      </Box>
    </Box>
  );
};
