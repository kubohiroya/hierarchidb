import { LandingPage } from "@hierarchidb/ui-landingpage";
import { Box, Typography } from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";

import { TreeToggleButtonGroup, type TreeConfig } from "@hierarchidb/ui-core";
import { Folder, AccountTree } from "@mui/icons-material";
import { useNavigate } from "react-router";
import { useCallback, useEffect, useState } from "react";
import { useAppConfig } from "../contexts/AppConfigContext";
import { UserLoginButton } from "@hierarchidb/ui-usermenu";

// Temporary type definition until TreeToggleButtonGroup is available

// Tree configurations for t and r trees
const treeButtonConfigs: TreeConfig[] = [
  {
    id: "r",
    label: "Resources",
    icon: Folder,
    routePath: "r",
    color: "primary",
    tooltip: "Navigate to Resources view",
  },
  {
    id: "p",
    label: "Projects",
    icon: AccountTree,
    routePath: "p",
    color: "secondary",
    tooltip: "Navigate to Projects view",
  },
];

export default function Index() {
  // Get app config from context
  const { appPrefix, appTitle, appDescription, appHomepage } = useAppConfig();
  const navigate = useNavigate();

  console.log(appPrefix);

  // Track if we're in browser environment to avoid SSR/hydration mismatch
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // SessionStorage key pattern for page node IDs
  const getSessionStorageKey = (treeId: string) => `lastPageNodeId_${treeId}`;

  // Get saved page node ID from SessionStorage (only in client)
  const getSavedPageNodeId = useCallback(
    (treeId: string): string | null => {
      if (!isClient) return null;
      try {
        return sessionStorage.getItem(getSessionStorageKey(treeId));
      } catch {
        return null;
      }
    },
    [isClient],
  );

  // Save page node ID to SessionStorage (only in client)
  const savePageNodeId = useCallback(
    (treeId: string, pageNodeId: string) => {
      if (!isClient) return;
      try {
        sessionStorage.setItem(getSessionStorageKey(treeId), pageNodeId);
      } catch {
        // Ignore storage errors
      }
    },
    [isClient],
  );

  // Handle tree selection
  const handleTreeSelect = useCallback(
    (treeId: string) => {
      const savedPageNodeId = getSavedPageNodeId(treeId) || "";
      const path1 = savedPageNodeId
        ? `/${treeId}/${savedPageNodeId}`
        : `/${treeId}`;
      const path = `t${path1}`;
      console.log(path);
      navigate(path);
    },
    [navigate, getSavedPageNodeId],
  );

  return (
    <>
      <title>{appTitle}</title>
      {appDescription ? (
        <meta name="description" content={appDescription} />
      ) : null}
      {/* You can change favicon dynamically by changing href below based on loader data or state */}
      <link rel="icon" href="favicon.svg" type="image/svg+xml" />
      <LandingPage
        logo={
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <StorageIcon sx={{ fontSize: 80, color: "primary.main" }} />
          </Box>
        }
        heading={appTitle}
        description={appDescription}
        githubUrl={appHomepage}
        onInfoClick={() => navigate("/info")}
        showInfoButton={true}
        showHelpButton={false}
      >
        {/* Top-left slot - could add version or environment info */}
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          v1.0.0
        </Typography>
        {/* Top-right slot - User menu */}
        <UserLoginButton />
        {/* TreeToggleButtonGroup temporarily commented out until component is available */}
        <TreeToggleButtonGroup
          trees={treeButtonConfigs}
          selectedTreeId={null}
          getSavedPageNodeId={getSavedPageNodeId}
          savePageNodeId={savePageNodeId}
          onTreeSelect={handleTreeSelect}
          orientation="horizontal"
          size="large"
          sx={{ backgroundColor: "background.paper", borderRadius: 2, p: 1 }}
        />
      </LandingPage>
    </>
  );
}
