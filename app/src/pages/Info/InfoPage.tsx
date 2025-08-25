import {
  Box,
  Typography,
  Link,
  Divider,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import { useNavigate } from "react-router";
import { LoadAppConfigReturn } from "~/loader";
import { LicenseInfo } from "~/components/LicenseInfo";
import { FullScreenDialog } from "@hierarchidb/ui-dialog";

// LicenseInfo temporarily commented out until component is available
// const LazyLicenseInfo = lazy(() =>
//   import('../../../../../docs/licenses.json').then((module) => ({
//     default: () => <LicenseInfo licenseData={module.default} />,
//   }))
// );

export function InfoPage({ appConfig }: { appConfig: LoadAppConfigReturn }) {
  const navigate = useNavigate();

  return (
    <FullScreenDialog
      open={true}
      onClose={() => navigate("/")}
      title={`About ${appConfig.appTitle}` || "About ..."}
      subtitle="Application information and licenses"
      icon={<InfoIcon />}
    >
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

          {/* License Information Section */}
          <Divider sx={{ my: 4 }} />
          <LicenseInfo />
        </Box>
    </FullScreenDialog>
  );
}
