/**
 * @file RouteDetailsStep.tsx
 * @description Route configuration step following the shared BasicInfo step.
 */

import { useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Divider } from '@mui/material';
import { useTranslation } from '../i18n/index.js';
import type { RouteEntity, RouteWorkingCopy, RouteCategory } from '../types/index.js';
import { RouteType, TransportMode } from '../types/index.js';
import { getRouteDraft } from '../utils/workingCopy.js';

export interface RouteDetailsStepProps {
  workingCopy: RouteWorkingCopy;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  disabled?: boolean;
}

export const RouteDetailsStep: React.FC<RouteDetailsStepProps> = ({
  workingCopy,
  onUpdate,
  onValidationChange,
  disabled = false,
}) => {
  const { translations } = useTranslation();
  const draft = useMemo(() => getRouteDraft(workingCopy), [workingCopy]);

  const resolvedRouteType = draft.routeType ?? RouteType.ROAD;
  const resolvedTransportModes = Array.isArray(draft.transportModes) ? draft.transportModes : [];
  const resolvedCategory = (draft.category as RouteCategory | undefined) ?? 'transportation';

  useEffect(() => {
    const isValid = Boolean(resolvedRouteType) && resolvedTransportModes.length > 0;
    onValidationChange(isValid);
  }, [onValidationChange, resolvedRouteType, resolvedTransportModes.length]);

  const emitUpdate = useCallback(
    (updates: Partial<RouteEntity>) => {
      onUpdate({
        ...updates,
        updatedAt: Date.now(),
      });
    },
    [onUpdate],
  );

  const handleRouteTypeChange = useCallback(
    (routeType: RouteType) => {
      emitUpdate({ routeType });
    },
    [emitUpdate],
  );

  const handleTransportModesChange = useCallback(
    (event: SelectChangeEvent<TransportMode | TransportMode[]>) => {
      const value = event.target.value;
      const transportModes = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? (value.split(',') as TransportMode[])
          : [];
      emitUpdate({ transportModes });
    },
    [emitUpdate],
  );

  const handleCategoryChange = useCallback(
    (category: RouteCategory) => {
      emitUpdate({ category });
    },
    [emitUpdate],
  );

  return (
    <Box sx={{ p: 3, maxWidth: 700, margin: '0 auto' }}>
      <Typography variant="h6" gutterBottom>
        {translations.basicInfo.nameLabel ?? translations.basicInfo.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {translations.basicInfo.descriptionLabel ?? translations.basicInfo.subtitle}
      </Typography>

      <Divider sx={{ my: 2 }} />

      <TextField
        select
        label={translations.basicInfo.routeTypeLabel}
        value={resolvedRouteType}
        onChange={(event) => handleRouteTypeChange(event.target.value as RouteType)}
        required
        fullWidth
        disabled={disabled}
        helperText={translations.basicInfo.routeTypeHelperText}
        error={!resolvedRouteType}
        sx={{ mb: 3 }}
      >
        {Object.values(RouteType).map((type) => (
          <MenuItem key={type} value={type}>
            {translations.routeTypes[type]}
          </MenuItem>
        ))}
      </TextField>

      <FormControl required fullWidth disabled={disabled} sx={{ mb: 3 }}>
        <InputLabel>{translations.basicInfo.transportModesLabel}</InputLabel>
        <Select
          multiple
          value={resolvedTransportModes}
          onChange={handleTransportModesChange}
          input={<OutlinedInput label={translations.basicInfo.transportModesLabel} />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as TransportMode[]).map((mode) => (
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
    </Box>
  );
};
