/**
 * Location Data Source Selection Step
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { DataSourceSelector } from '@hierarchidb/ui-datasource';
import type { LocationDataSource, LocationEntity } from '../../../common/types/index.js';
import { DataSourceOption } from '@hierarchidb/ui-datasource';
import { useTranslation } from '../../../common/i18n/index.js';

const ORDERED_DATA_SOURCES: LocationDataSource[] = [
  'openstreetmap',
  'overpass',
  'geonames',
  'wikidata',
  'custom',
  'manual',
];

interface LocationDataSourceStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
}

export const LocationDataSourceStep: React.FC<LocationDataSourceStepProps> = ({ draft, onUpdate }) => {
  const { t } = useTranslation();

  const value = useMemo<LocationDataSource>(() => (
    (draft.dataSource as LocationDataSource) ?? 'openstreetmap'
  ), [draft.dataSource]);

  const options = useMemo<DataSourceOption[]>(() => (
    ORDERED_DATA_SOURCES.map((sourceId) => ({
      id: sourceId,
      name: t(`dataSource.options.${sourceId}.name`, sourceId),
      description: t(
        `dataSource.options.${sourceId}.description`,
        t('dataSource.descriptionFallback', 'Select a data source')
      ),
    }))
  ), [t]);

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
        {t('dataSource.description', 'Choose a dataset source to fetch location data.')}
      </Typography>

      <DataSourceSelector
        options={options}
        value={value}
        onChange={handleChange}
      />
    </Box>
  );
};
