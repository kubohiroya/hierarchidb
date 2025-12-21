/**
 * @file RouteDataSourceStep.tsx
 * @description Step 2: select data source for route generation.
 */

import { useCallback, useEffect, useId, useMemo } from 'react';
import { Box, Divider, MenuItem, TextField, Typography } from '@mui/material';
import { useTranslation } from '../../../common/i18n/index.js';
import type { RouteEntity, RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { getRouteUpdaterPayload } from '../../../common/utils/draft.js';

export interface RouteDataSourceStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  disabled?: boolean;
}

const DATA_SOURCE_OPTIONS = [
  { id: 'openstreetmap', key: 'openstreetmap' },
  { id: 'searoute', key: 'searoute' },
  { id: 'custom', key: 'custom' },
] as const;

type DataSourceKey = typeof DATA_SOURCE_OPTIONS[number]['id'];

export const RouteDataSourceStep: React.FC<RouteDataSourceStepProps> = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const fieldId = useId();
  const draft = useMemo(() => getRouteUpdaterPayload(draftProp), [draftProp]);
  const resolvedSource = (draft.dataSourceName as DataSourceKey | undefined) ?? 'openstreetmap';

  const emitUpdate = useCallback(
    (updates: Partial<RouteEntity>) => {
      onUpdate({
        ...updates,
      });
    },
    [onUpdate],
  );

  useEffect(() => {
    onValidationChange(Boolean(resolvedSource));
  }, [onValidationChange, resolvedSource]);

  useEffect(() => {
    if (!draft.dataSourceName) {
      emitUpdate({ dataSourceName: resolvedSource });
    }
  }, [draft.dataSourceName, emitUpdate, resolvedSource]);

  return (
    <Box sx={{ p: 3, maxWidth: 720, margin: '0 auto' }}>
      <Typography variant="h6" gutterBottom>
        {t('dataSource.title', 'Data Source')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('dataSource.description', 'Choose the primary dataset or service that provides route geometry.')}
      </Typography>

      <Divider sx={{ my: 2 }} />

      <TextField
        select
        label={t('dataSource.label', 'Route data source')}
        id={`${fieldId}-route-data-source`}
        name="route-data-source"
        value={resolvedSource}
        onChange={(event) => emitUpdate({ dataSourceName: event.target.value as RouteEntity['dataSourceName'] })}
        required
        fullWidth
        disabled={disabled}
        helperText={t('dataSource.helperText', 'Select the data source used to generate routes.')}
        inputProps={{ id: `${fieldId}-route-data-source`, name: 'route-data-source' }}
      >
        {DATA_SOURCE_OPTIONS.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {t(`dataSource.options.${option.key}`, option.id)}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
};
