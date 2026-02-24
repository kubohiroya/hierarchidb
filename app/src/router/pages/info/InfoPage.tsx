import { AutoHideFullScreenDialog as FullScreenDialog } from '@hierarchidb/ui-plugin-shell/ui-dialog';
import { Info as InfoIcon } from '@mui/icons-material';
import { Box, Divider, Link, Typography } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type { LoadAppConfigReturn } from '~/loader';
import { useAppDocumentTitle } from '~/router/title/pageTitle';
import { LicenseInfo } from './LicenseInfo.js';

export function InfoPage({ appConfig }: { appConfig: LoadAppConfigReturn }) {
  const navigate = useNavigate();
  useAppDocumentTitle('Info');

  return (
    <FullScreenDialog
      open={true}
      onClose={() => navigate({ to: '/' })}
      title={appConfig.appTitle ? `About ${appConfig.appTitle}` : 'About ...'}
      subtitle="Application information and licenses"
      icon={<InfoIcon />}
    >
      <Box sx={{ width: '100%' }}>
        {/* Temporary InfoContent replacement */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            {appConfig.appTitle}
          </Typography>
          <Typography variant="body1" >
            {appConfig.appDescription}
          </Typography>
          {appConfig.appDetails && (
            <Typography variant="body2" >
              {appConfig.appDetails}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {`Developed by ${appConfig.appAttribution}`}
          </Typography>
          {appConfig.appHomepage && (
            <Link href={appConfig.appHomepage} target="_blank" rel="noopener">
              View on GitHub
            </Link>
          )}
        </Box>

        {/* License Information Section */}
        <Divider sx={{ my: 4 }} />
        <LicenseInfo />
      </Box>
    </FullScreenDialog>
  );
}
