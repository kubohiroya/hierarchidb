import { LandingPage } from '@hierarchidb/ui-landingpage';
import { Box, Typography } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import FolderIcon from '@mui/icons-material/Folder';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
// @ts-ignore - TreeToggleButtonGroup will be available after build
import { TreeToggleButtonGroup, type TreeConfig } from '@hierarchidb/ui-core';
import { useNavigate } from 'react-router';
import { useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAppConfig } from '../contexts/AppConfigContext';

// Tree configurations for t and r trees
const treeConfigs: TreeConfig[] = [
  {
    id: 'r',
    label: 'Resources',
    icon: FolderIcon,
    routePath: 'r',
    color: 'primary',
    tooltip: 'Navigate to Resources view',
  },
  {
    id: 'p',
    label: 'Projects',
    icon: AccountTreeIcon,
    routePath: 'p',
    color: 'secondary',
    tooltip: 'Navigate to Projects view',
  },
];

export default function Index() {
  // Get app config from context
  const { appPrefix, appTitle, appDescription, appHomepage } = useAppConfig();
  const navigate = useNavigate();

  // SessionStorage key pattern for page node IDs
  const getSessionStorageKey = (treeId: string) => `lastPageNodeId_${treeId}`;

  // Get saved page node ID from SessionStorage
  const getSavedPageNodeId = useCallback((treeId: string): string | null => {
    try {
      return sessionStorage.getItem(getSessionStorageKey(treeId));
    } catch {
      return null;
    }
  }, []);

  // Save page node ID to SessionStorage
  const savePageNodeId = useCallback((treeId: string, pageNodeId: string) => {
    try {
      sessionStorage.setItem(getSessionStorageKey(treeId), pageNodeId);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Handle tree selection
  const handleTreeSelect = useCallback(
    (treeId: string) => {
      const savedPageNodeId = getSavedPageNodeId(treeId) || '';
      const path = `t` + (savedPageNodeId ? `/${treeId}/${savedPageNodeId}` : `/${treeId}`);
      console.log(path);
      navigate(path);
    },
    [navigate, getSavedPageNodeId]
  );

  return (
    <>
      <Helmet>
        <title>{appTitle}</title>
        {appDescription ? <meta name="description" content={appDescription} /> : null}
        {/* You can change favicon dynamically by changing href below based on loader data or state */}
        <link rel="icon" href="favicon.svg" type="image/svg+xml" />
      </Helmet>
      <LandingPage
        logo={
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <StorageIcon sx={{ fontSize: 80, color: 'primary.main' }} />
          </Box>
        }
        heading={appTitle}
        description={appDescription}
        githubUrl={appHomepage}
        onInfoClick={() => navigate('/info')}
        showInfoButton={true}
        showHelpButton={false}
      >
        {/* Top-left slot - could add version or environment info */}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          v1.0.0
        </Typography>
        {/* Top-right slot - could add user menu or settings */}
        <TreeToggleButtonGroup
          trees={treeConfigs}
          selectedTreeId={null}
          getSavedPageNodeId={getSavedPageNodeId}
          savePageNodeId={savePageNodeId}
          onTreeSelect={handleTreeSelect}
          orientation="horizontal"
          size="large"
          sx={{ backgroundColor: 'background.paper', borderRadius: 2, p: 1 }}
        />
      </LandingPage>
    </>
  );
}
