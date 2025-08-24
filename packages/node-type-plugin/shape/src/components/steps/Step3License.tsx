import React from 'react';
import { Box, Typography, Button, Alert, AlertTitle, Stack } from '@mui/material';
import { OpenInNew as OpenInNewIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import type { StepProps } from '~/types';
import { DATA_SOURCE_CONFIGS } from '~/mock/data';

/**
 * Step 3: License Agreement
 * Uses @hierarchidb/_app-datasource components for license display
 */
export const Step3License: React.FC<StepProps> = ({ workingCopy, onUpdate, disabled }) => {
  const dataSource = DATA_SOURCE_CONFIGS[workingCopy.dataSourceName];

  if (!dataSource) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Please select a data source first</Alert>
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
      <Typography variant="body2" color="text.secondary" paragraph>
        Please review and agree to the licensing requirements for {dataSource.displayName}.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>{dataSource.displayName} License</AlertTitle>

        <Stack spacing={2}>
          <Typography variant="body2">
            <strong>License Type:</strong> {dataSource.license}
          </Typography>

          <Typography variant="body2">
            <strong>Attribution:</strong> {dataSource.attribution}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            By clicking the button below, you acknowledge that you have read and agree to comply
            with the licensing requirements.
          </Typography>

          <Button
            variant={workingCopy.licenseAgreement ? 'outlined' : 'contained'}
            color={workingCopy.licenseAgreement ? 'success' : 'warning'}
            size="large"
            startIcon={<OpenInNewIcon />}
            onClick={handleLicenseAgreement}
            fullWidth
            disabled={disabled}
            sx={{ mt: 2 }}
          >
            {workingCopy.licenseAgreement
              ? 'License Agreed - View Details'
              : 'View License Terms & Agree'}
          </Button>
        </Stack>
      </Alert>

      {workingCopy.licenseAgreement && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon color="success" />
            <Typography variant="body2">
              ✓ You have agreed to the {dataSource.license} license terms for{' '}
              {dataSource.displayName}
            </Typography>
          </Stack>
          {workingCopy.licenseAgreedAt && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Agreed on: {new Date(workingCopy.licenseAgreedAt).toLocaleString()}
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  );
};
