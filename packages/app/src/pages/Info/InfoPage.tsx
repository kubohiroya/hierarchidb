import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Link,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// import { InfoDialog, InfoContent } from '@hierarchidb/ui-core';
// LicenseInfo temporarily commented out until component is available
// import { LicenseInfo } from '@hierarchidb/ui-core';
import { useNavigate } from "react-router";

import { LoadAppConfigReturn } from "~/loader";

// LicenseInfo temporarily commented out until component is available
// const LazyLicenseInfo = lazy(() =>
//   import('../../../../../docs/licenses.json').then((module) => ({
//     default: () => <LicenseInfo licenseData={module.default} />,
//   }))
// );

export function InfoPage({ appConfig }: { appConfig: LoadAppConfigReturn }) {
  const navigate = useNavigate();

  return (
    <Dialog open={true} onClose={() => navigate("/")} fullScreen={true}>
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {`About ${appConfig.appTitle}` || "About ..."}
        <IconButton onClick={() => navigate("/")} edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ width: "100%" }}>
          {/* Temporary InfoContent replacement */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" gutterBottom>
              {appConfig.appTitle}
            </Typography>
            <Typography variant="body1" paragraph>
              {appConfig.appDescription}
            </Typography>
            {appConfig.appDetails && (
              <Typography variant="body2" paragraph>
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

          {/* LicenseInfo temporarily commented out until component is available */}
          {/* <Alert severity="info" sx={{ mt: 4 }}>
            <Suspense fallback={<LinearProgress />}>
              <LazyLicenseInfo />
            </Suspense>
          </Alert> */}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
