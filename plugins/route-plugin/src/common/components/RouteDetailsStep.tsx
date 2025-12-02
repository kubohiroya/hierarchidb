/**
 * @file RouteDetailsStep.tsx
 * @description Route configuration step following the shared BasicInfo step.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { Box, TextField, MenuItem } from '@mui/material';
import { Divider } from '@mui/material';
import { useTranslation } from '../i18n/index.js';
import type { RouteEntity, RouteUpdaterPayload, RouteType } from '../entities/RouteEntity.js';
import { ROUTE_TYPES } from '../entities/RouteEntity.js';
import { getRouteUpdaterPayload } from '../utils/draft.js';

export interface RouteDetailsStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  disabled?: boolean;
}

export const RouteDetailsStep: React.FC<RouteDetailsStepProps> = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
  disabled = false,
}) => {
  const { translations } = useTranslation();
  const draft = useMemo(() => getRouteUpdaterPayload(draftProp), [draftProp]);

  const resolvedRouteType = (draft.routeType as RouteType | undefined) ?? ROUTE_TYPES.ROAD;
  const resolvedDataSource = draft.dataSourceName ?? 'openstreetmap';

  useEffect(() => {
    const isValid = Boolean(resolvedRouteType) && Boolean(resolvedDataSource);
    onValidationChange(isValid);
  }, [onValidationChange, resolvedRouteType, resolvedDataSource]);

  const emitUpdate = useCallback(
    (updates: Partial<RouteEntity>) => {
      onUpdate({
        ...updates,
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

  return (
    <Box sx={{ p: 3, maxWidth: 700, margin: '0 auto' }}>
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
        {Object.values(ROUTE_TYPES).map((type) => (
          <MenuItem key={type} value={type}>
            {translations.routeTypes[type]}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Data source"
        value={resolvedDataSource}
        onChange={(event) => emitUpdate({ dataSourceName: event.target.value as RouteEntity['dataSourceName'] })}
        required
        fullWidth
        disabled={disabled}
        helperText="Choose openstreetmap for OSRM/Overpass or custom for tabular import"
      >
        <MenuItem value="openstreetmap">OpenStreetMap</MenuItem>
        <MenuItem value="custom">Custom (tabular)</MenuItem>
      </TextField>

      {/* transportModes/category removed for current scope */}
    </Box>
  );
};
