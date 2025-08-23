import React, { useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { DataSourceLicenseAgreement } from './DataSourceLicenseAgreement';
import { getDataSourceConfig, DataSourceName } from '../types/DataSource';

export interface DataSourceLicenseStepProps {
  selectedDataSource: DataSourceName;
  onLicenseAgreed: (agreed: boolean) => void;
  licenseAgreed?: boolean;
}

export const DataSourceLicenseStep: React.FC<DataSourceLicenseStepProps> = ({
  selectedDataSource,
  onLicenseAgreed,
  licenseAgreed = false,
}) => {
  const [hasOpenedLicense, setHasOpenedLicense] = useState(licenseAgreed);
  const dataSourceConfig = getDataSourceConfig(selectedDataSource);

  const handleLicenseAgreementChange = (agreed: boolean, _timestamp?: string) => {
    setHasOpenedLicense(agreed);
    onLicenseAgreed(agreed);
  };

  if (!dataSourceConfig) {
    return (
      <Box>
        <Alert severity="error">
          Data source configuration not found: {selectedDataSource}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        License Agreement
      </Typography>
      
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Before using <strong>{dataSourceConfig.displayName}</strong> data, please review and agree to the license terms.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Selected:</strong> {dataSourceConfig.displayName}
        </Typography>
        <Typography variant="body2">
          <strong>License:</strong> {dataSourceConfig.licenseType.toUpperCase()}
        </Typography>
        <Typography variant="body2">
          <strong>Category:</strong> {dataSourceConfig.category}
        </Typography>
      </Alert>
      
      <DataSourceLicenseAgreement
        dataSourceName={selectedDataSource}
        licenseAgreement={hasOpenedLicense}
        onLicenseAgreementChange={handleLicenseAgreementChange}
      />
    </Box>
  );
};