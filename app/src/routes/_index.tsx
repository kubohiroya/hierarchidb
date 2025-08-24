import { Box, Typography, Container, Stack, IconButton } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import InfoIcon from '@mui/icons-material/Info';
import GitHubIcon from '@mui/icons-material/GitHub';

import { TreeToggleButtonGroup, type TreeConfig } from '@hierarchidb/ui-core';
import { Folder, AccountTree } from '@mui/icons-material';
import { useNavigate } from 'react-router';
import { useCallback, useEffect, useState } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';

// Temporary type definition until TreeToggleButtonGroup is available

// Tree configurations for t and r trees
const treeButtonConfigs: TreeConfig[] = [
  {
    id: 'r',
    label: 'Resources',
    icon: Folder,
    routePath: 'r',
    color: 'primary',
    tooltip: 'Navigate to Resources view',
  },
  {
    id: 'p',
    label: 'Projects',
    icon: AccountTree,
    routePath: 'p',
    color: 'secondary',
    tooltip: 'Navigate to Projects view',
  },
];

export default function Index() {
  // Get _app config from context
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
    [isClient]
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
    [isClient]
  );

  // Handle tree selection
  const handleTreeSelect = useCallback(
    (treeId: string) => {
      const savedPageNodeId = getSavedPageNodeId(treeId) || '';
      const path1 = savedPageNodeId ? `/${treeId}/${savedPageNodeId}` : `/${treeId}`;
      const path = `t${path1}`;
      console.log(path);
      navigate(path);
    },
    [navigate, getSavedPageNodeId]
  );

  return (
    <>
      <title>{appTitle}</title>
      {appDescription ? <meta name="description" content={appDescription} /> : null}
      {/* You can change favicon dynamically by changing href below based on loader data or state */}
      <link rel="icon" href="favicon.svg" type="image/svg+xml" />
      <Container maxWidth="lg">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            py: 4,
          }}
        >
          {/* Header with version and user menu */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              v1.0.0
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {appHomepage && (
                <IconButton
                  href={appHomepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                >
                  <GitHubIcon />
                </IconButton>
              )}
              <IconButton onClick={() => navigate('/info')} size="small">
                <InfoIcon />
              </IconButton>
              <UserLoginButton />
            </Stack>
          </Box>

          {/* Main content */}
          <Stack spacing={4} alignItems="center">
            {/* Logo */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StorageIcon sx={{ fontSize: 80, color: 'primary.main' }} />
            </Box>

            {/* Title and description */}
            <Stack spacing={2} alignItems="center" textAlign="center">
              <Typography variant="h3" component="h1">
                {appTitle}
              </Typography>
              {appDescription && (
                <Typography variant="body1" color="text.secondary" maxWidth={600}>
                  {appDescription}
                </Typography>
              )}
            </Stack>

            {/* Tree selection buttons */}
            <TreeToggleButtonGroup
              trees={treeButtonConfigs}
              selectedTreeId={null}
              getSavedPageNodeId={getSavedPageNodeId}
              savePageNodeId={savePageNodeId}
              onTreeSelect={handleTreeSelect}
              orientation="horizontal"
              size="large"
              sx={{ backgroundColor: 'background.paper', borderRadius: 2, p: 1 }}
            />
          </Stack>
        </Box>
      </Container>
    </>
  );
}
