/**
 * Location Data Source Selection Step
 */

import type React from 'react';
import { useMemo } from 'react';
import { Typography } from '@mui/material';
import {
  DataSourceWithLicense,
  type DataSourceWithLicenseOption,
} from '@hierarchidb/ui-datasource';
import type { LocationDataSource, LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import type { Timestamp } from '@hierarchidb/common-types';

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
  licenseRequired?: boolean;
  disabled?: boolean;
}

const LICENSE_DETAILS: Record<
  LocationDataSource,
  { licenseName: string; licenseUrl?: string; attribution?: string }
> = {
  openstreetmap: {
    licenseName: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    attribution: '© OpenStreetMap contributors',
  },
  overpass: {
    licenseName: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    attribution: '© OpenStreetMap contributors',
  },
  geonames: {
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Data provided by GeoNames',
  },
  wikidata: {
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'Data from Wikidata contributors',
  },
  custom: {
    licenseName: 'Custom terms',
    licenseUrl: undefined,
    attribution: undefined,
  },
  manual: {
    licenseName: 'User provided',
    licenseUrl: undefined,
    attribution: undefined,
  },
};

export const LocationDataSourceStep: React.FC<LocationDataSourceStepProps> = ({
  draft,
  onUpdate,
  licenseRequired = true,
  disabled,
}) => {
  const { t } = useTranslation();

  const value = useMemo<LocationDataSource>(
    () => (draft.dataSource as LocationDataSource) ?? 'openstreetmap',
    [draft.dataSource]
  );

  const options = useMemo<DataSourceWithLicenseOption[]>(
    () =>
      ORDERED_DATA_SOURCES.map((sourceId) => {
        const license = LICENSE_DETAILS[sourceId];
        return {
          id: sourceId,
          name: t(`dataSource.options.${sourceId}.name`, sourceId),
          description: t(
            `dataSource.options.${sourceId}.description`,
            t('dataSource.descriptionFallback', 'Select a data source')
          ),
          licenseName: license?.licenseName ?? 'License',
          licenseUrl: license?.licenseUrl,
          attribution: license?.attribution,
        };
      }),
    [t]
  );

  const description = t('dataSource.description', 'Choose a dataset source to fetch location data.');

  return (
    <DataSourceWithLicense<Timestamp>
      options={options}
      state={{
        dataSourceId: value,
        licenseAgreement: Boolean(draft.licenseAgreement),
        licenseAgreedAt: draft.licenseAgreedAt,
      }}
      onChange={(next) => {
        const nextSource = (next.dataSourceId as LocationDataSource | undefined) ?? value;
        onUpdate({
          dataSource: nextSource,
          licenseAgreement: next.licenseAgreement,
          licenseAgreedAt: next.licenseAgreedAt,
        });
      }}
      licenseRequired={licenseRequired}
      disabled={disabled}
      description={
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      }
      createAgreedAt={() => Date.now() as Timestamp}
    />
  );
};
