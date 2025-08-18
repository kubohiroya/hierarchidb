import { Box, Alert, LinearProgress } from '@mui/material';

import { lazy, Suspense } from 'react';
import { InfoDialog, InfoContent, LicenseInfo } from '@hierarchidb/ui-core';
import { useNavigate } from 'react-router';

import { LoadAppConfigReturn } from '~/loader';

const LazyLicenseInfo = lazy(() =>
  import('../../../../../docs/licenses.json').then((module) => ({
    default: () => <LicenseInfo licenseData={module.default} />,
  }))
);

export function InfoPage({ appConfig }: { appConfig: LoadAppConfigReturn }) {
  const navigate = useNavigate();

  return (
    <InfoDialog
      open={true}
      onClose={() => navigate('/')}
      title={`About ${appConfig.appTitle}` || 'About ...'}
      fullScreen={true}
    >
      <Box sx={{ width: '100%' }}>
        <InfoContent
          title={appConfig.appTitle}
          description={appConfig.appDescription}
          details={appConfig.appDetails}
          attribution={`Developed by ${appConfig.appAttribution}`}
          githubUrl={appConfig.appHomepage}
        />

        <Alert severity="info" sx={{ mt: 4 }}>
          <Suspense fallback={<LinearProgress />}>
            <LazyLicenseInfo />
          </Suspense>
        </Alert>
      </Box>
    </InfoDialog>
  );
}
