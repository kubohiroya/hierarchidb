import { Box, Typography, Container, Stack, IconButton, Tooltip } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import InfoIcon from '@mui/icons-material/Info';
import GitHubIcon from '@mui/icons-material/GitHub';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExtensionIcon from '@mui/icons-material/Extension';

import { TreeToggleButtonGroup, type TreeConfig } from '@hierarchidb/ui-core';
import { Folder, AccountTree } from '@mui/icons-material';
import { useNavigate } from 'react-router';
import { useCallback, useEffect, useState } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';

// Temporary type definition until TreeToggleButtonGroup is available

// Meta function for React Router v7
export function meta() {
  const appPrefix = import.meta.env.BASE_URL || '/';
  return [
    { title: 'HierarchiDB' },
    { name: 'description', content: 'High-performance tree-structured data management framework' },
    { 
      tagName: 'link',
      rel: 'icon',
      type: 'image/svg+xml',
      href: `${appPrefix}favicon.svg`
    },
    {
      tagName: 'link',
      rel: 'icon',
      type: 'image/png',
      href: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAKhSURBVFiFtZfPaxNBFMc/m91NTNLUVqtQKHgQPIgHL/4DD0LBgxc9ePDkyZMnT548CIIHQfBQLN48ePAgiAcPgiAIgqCIVbGtaWuTJtlkdnZnxkNqsp3Zbhr6hYVh3rz3/bx582ZnBXYhIgJA07R/YmVZRtM0hBBYloUQAtu2kVKiaRpSShzHQdM0HMfBtm2klGiahpQS27axLAtN03Ach2g0iqZpCCGwLIsNm5VSymw2K7PZrJRSSimlzOVyMpfLScdxpOu60nVdKaWUruuGsG1bOo4jHceRtm1Lx3Gk67rSdV3Z6TiO1HVdBvZzXVd2Op12EaqqKl3XbbPneZ7neZ7v+77v+/I/6Ha7XTab3RSPx2N+uBPZto1t2wgh/IsQEYEQIhCXUmJZVgdLKTEMo0MEA8vlcrler9MNq9Vq19pisUi73Q6kjV4ZVFWF4zi+RVRVxXGcTkIIgaqqCCHQNG2TrutYlkU4HEZRFBRF6fQH8TCHhoYAqNfr2LaNoij09PQA0Gq1cByHSCTSMfX392/adyAQGRkZAWBtbY1qtYpt29Trddrt9lZz3yLhcJhyuUy5XKbdbmOaJqZpYprmdsO2xODgIIqiYJomqqqiqiqGYWAYBrquB/K/RTRNo9VqYRgGjuMQjUaJRqOEQiFCoRCKomypOhAIhUIAJBIJEokEAJFIZFs8/1dhGEaIx+MAVCoVADRNIxQKdRJCCCzLwnVdXNft/C4T/7yCaDRKLBajVqtRrVYxTbPz1wPQ29vbh1IjhOhE/v5VFKXrdRAIrF+u6zpCCGzbJhaL0dfXRywWQ1EU4vE4rutSr9exLIsVVVU/ptPp1xsbpFKpL6lU6sv8/Pzi/Pz84vz8fCmVSn0B3mUymeVMJvMGKGUymXKH+wOHEVjLHmWUdAAAAABJRU5ErkJggg=='
    }
  ];
}

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
            <UserLoginButton />
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

          {/* Bottom-left corner buttons */}
          <Box
            sx={{
              position: 'fixed',
              bottom: 16,
              left: 16,
              display: 'flex',
              flexDirection: 'row',
              gap: 1,
            }}
          >
            {/* 1. Help/Tour - User onboarding and assistance */}
            <Tooltip title="Open Guided Tour">
              <IconButton
                onClick={() => {
                  // TODO: Implement guided tour functionality
                  console.log('Guided tour not yet implemented');
                }}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <HelpOutlineIcon />
              </IconButton>
            </Tooltip>

            {/* 2. Info/License - Application information and legal */}
            <Tooltip title="License Information">
              <IconButton
                onClick={() => navigate('/info')}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <InfoIcon />
              </IconButton>
            </Tooltip>

            {/* 3. Plugins - Technical/Developer features */}
            <Tooltip title="Plugin Registry">
              <IconButton
                onClick={() => navigate('/plugins')}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ExtensionIcon />
              </IconButton>
            </Tooltip>

            {/* 4. GitHub - External link to source code */}
            {appHomepage && (
              <Tooltip title="View Source on GitHub">
                <IconButton
                  href={appHomepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  sx={{
                    color: 'text.secondary',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <GitHubIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Container>
    </>
  );
}
