/**
 * Location Data Source Selection Step
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { DataSourceSelector, type DataSourceOption } from '@hierarchidb/ui-datasource';
import type { LocationDataSource, LocationWorkingCopy } from '../../types/index.js';
import { useTranslation } from '../../i18n/index.js';

const ORDERED_DATA_SOURCES: LocationDataSource[] = [
  'openstreetmap',
  'overpass',
  'geonames',
  'wikidata',
  'custom',
  'manual',
];

interface LocationDataSourceStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate: (updates: Partial<LocationWorkingCopy>) => void;
}

export const LocationDataSourceStep: React.FC<LocationDataSourceStepProps> = ({ workingCopy, onUpdate }) => {
  const { translations } = useTranslation();

  const value = useMemo<LocationDataSource>(() => (
    (workingCopy.payload?.draft?.dataSource as LocationDataSource)
    ?? (workingCopy.dataSource as LocationDataSource)
    ?? 'openstreetmap'
  ), [workingCopy]);

  const options = useMemo<DataSourceOption[]>(() => (
    ORDERED_DATA_SOURCES.map((sourceId) => ({
      id: sourceId,
      name: translations.dataSources?.[sourceId] ?? sourceId,
      description: translations.dataSourceDescriptions?.[sourceId]
        ?? translations.dialog.datasetDescription,
    }))
  ), [translations.dataSources, translations.dataSourceDescriptions, translations.dialog.datasetDescription]);

  const handleChange = (next: string) => {
    const nextSource = next as LocationDataSource;
    onUpdate({
      dataSource: nextSource,
      licenseAgreement: false,
      licenseAgreedAt: undefined,
    });
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Typography variant="body2" color="text.secondary">
        {translations.dialog.dataSourceDescription ?? translations.dialog.datasetDescription}
      </Typography>

      <DataSourceSelector
        options={options}
        value={value}
        onChange={handleChange}
      />
    </Box>
  );
};
