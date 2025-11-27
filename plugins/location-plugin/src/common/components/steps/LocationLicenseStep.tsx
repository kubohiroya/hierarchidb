/**
 * License agreement step for Location dialog.
 */

import type React from 'react';
import { Box, Typography } from '@mui/material';
import { LicenseAgreementStep } from '@hierarchidb/ui-license';
import type { Timestamp } from '@hierarchidb/common-types';
import type { LocationEntity } from '../../types/index.js';
import { useTranslation } from '../../i18n/index.js';
import { getLocationDataSource } from '../../datasources/LocationDataSourceDefinitions.js';

interface LocationLicenseStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
}

export const LocationLicenseStep: React.FC<LocationLicenseStepProps> = ({ draft, onUpdate }) => {
  const { translations } = useTranslation();

  const dataSourceId = draft.dataSource ?? 'openstreetmap';
  const dataSource = getLocationDataSource(dataSourceId);

  if (!dataSource) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          {translations.dialog.selectDataSourceFirst ?? 'Please select a data source first.'}
        </Typography>
      </Box>
    );
  }

  return (
    <LicenseAgreementStep
      sourceName={dataSource.name}
      details={{
        licenseName: dataSource.license,
        attribution: dataSource.attribution,
        url: dataSource.licenseUrl,
      }}
      state={{
        agreed: Boolean(draft.licenseAgreement),
        agreedAt: draft.licenseAgreedAt ? new Date(draft.licenseAgreedAt).toISOString() : undefined,
      }}
      onAgree={() => {
        onUpdate({
          licenseAgreement: true,
          licenseAgreedAt: Date.now() as Timestamp,
        });
      }}
    />
  );
};
