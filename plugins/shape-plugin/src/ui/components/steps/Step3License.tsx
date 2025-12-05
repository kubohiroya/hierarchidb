import type React from 'react';
import { Box, Typography } from '@mui/material';
import { LicenseAgreementStep } from '@hierarchidb/ui-license';
import type { StepProps } from '../../../common/shared/index.js';
import { DATA_SOURCE_CONFIGS } from '../../../common/mock/data.js';

/**
 * Step 3: License Agreement
 * Uses @hierarchidb/_app-datasource components for license display
 */
export const Step3License: React.FC<StepProps> = ({ draft, onUpdate, disabled }) => {
  const draftData = draft ?? {};
  const dataSourceKey = draftData.dataSourceName ?? '';
  const dataSource = dataSourceKey ? DATA_SOURCE_CONFIGS[dataSourceKey] : undefined;

  if (!dataSource) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Please select a data source first.
        </Typography>
      </Box>
    );
  }

  const handleLicenseAgreement = () => {
    // Open license URL in new tab and mark as agreed
    if (dataSource.licenseUrl) {
      window.open(dataSource.licenseUrl, '_blank', 'noopener,noreferrer');
    }
    onUpdate({
      licenseAgreement: true,
      licenseAgreedAt: new Date().toISOString(),
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        License Agreement
      </Typography>
      <LicenseAgreementStep
        sourceName={dataSource.displayName}
        details={{
          licenseName: dataSource.license,
          attribution: dataSource.attribution,
          url: dataSource.licenseUrl,
        }}
        state={{
          agreed: Boolean(draftData.licenseAgreement),
          agreedAt: draftData.licenseAgreedAt,
        }}
        onAgree={handleLicenseAgreement}
        disabled={disabled}
      />
    </Box>
  );
};
