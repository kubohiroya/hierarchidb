/**
 * License agreement step for Location dialog.
 */

import type React from 'react';
import { Box, Typography } from '@mui/material';
import { LicenseAgreementStep } from '@hierarchidb/ui-license';
import type { Timestamp } from '@hierarchidb/core-types';
import type { LocationEntity } from '~/common/types/index';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { getLocationDataSource } from '~/common/datasources/LocationDataSourceDefinitions';

interface LocationLicenseStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
}

export const LocationLicenseStep: React.FC<LocationLicenseStepProps> = ({ draft, onUpdate }) => {
  const { t } = useTranslation('location-plugin');

  const dataSourceId = draft.dataSource ?? 'openstreetmap';
  const dataSource = getLocationDataSource(dataSourceId);

  if (!dataSource) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          {t('dialog.selectDataSourceFirst', 'Please select a data source first.')}
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
