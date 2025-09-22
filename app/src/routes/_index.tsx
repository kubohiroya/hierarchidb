import { Box, Button, IconButton, Tooltip } from '@mui/material';
import { Info as InfoIcon, GitHub as GitHubIcon, HelpOutline as HelpOutlineIcon, Extension as ExtensionIcon, LocalOffer as LocalOfferIcon } from '@mui/icons-material';

import { type TreeConfig, TreeToggleButtonGroup } from '@hierarchidb/ui-core';
import { AccountTree, Folder } from '@mui/icons-material';
import { useNavigate } from 'react-router';
import { useCallback, useEffect, useState } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext.js';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';
import { TitleLogo } from '../components/TitleLogo.js';
import { TopPageGuidedTour } from '@hierarchidb/runtime-ui-tour';
import { loadAppConfig, resolveAssetHref } from '../loadAppConfig.js';

// Temporary type definition until TreeToggleButtonGroup is available

// Meta function for React Router v7
export function meta() {
  const { appPrefix, appFavicon } = loadAppConfig();
  const faviconHref = resolveAssetHref(appPrefix, appFavicon);
  return [
    { title: 'HierarchiDB' },
    { name: 'description', content: 'High-performance tree-structured data management framework' },
    {
      tagName: 'link',
      rel: 'icon',
      type: 'image/svg+xml',
      href: faviconHref,
    },
    {
      tagName: 'link',
      rel: 'icon',
      type: 'image/png',
      href: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAKhSURBVFiFtZfPaxNBFMc/m91NTNLUVqtQKHgQPIgHL/4DD0LBgxc9ePDkyZMnT548CIIHQfBQLN48ePAgiAcPgiAIgqCIVbGtaWuTJtlkdnZnxkNqsp3Zbhr6hYVh3rz3/bx582ZnBXYhIgJA07R/YmVZRtM0hBBYloUQAtu2kVKiaRpSShzHQdM0HMfBtm2klGiahpQS27axLAtN03Ach2g0iqZpCCGwLIsNm5VSymw2K7PZrJRSSimlzOVyMpfLScdxpOu60nVdKaWUruuGsG1bOo4jHceRtm1Lx3Gk67rSdV3Z6TiO1HVdBvZzXVd2Op12EaqqKl3XbbPneZ7neZ7v+77v+/I/6Ha7XTab3RSPx2N+uBPZto1t2wgh/IsQEYEQIhCXUmJZVgdLKTEMo0MEA8vlcrler9MNq9Vq19pisUi73Q6kjV4ZVFWF4zi+RVRVxXGcTkIIgaqqCCHQNG2TrutYlkU4HEZRFBRF6fQH8TCHhoYAqNfr2LaNoij09PQA0Gq1cByHSCTSMfX392/adyAQGRkZAWBtbY1qtYpt29Trddrt9lZz3yLhcJhyuUy5XKbdbmOaJqZpYprmdsO2xODgIIqiYJomqqqiqiqGYWAYBrquB/K/RTRNo9VqYRgGjuMQjUaJRqOEQiFCoRCKomypOhAIhUIAJBIJEokEAJFIZFs8/1dhGEaIx+MAVCoVADRNIxQKdRJCCCzLwnVdXNft/C4T/7yCaDRKLBajVqtRrVYxTbPz1wPQ29vbh1IjhOhE/v5VFKXrdRAIrF+u6zpCCGzbJhaL0dfXRywWQ1EU4vE4rutSr9exLIsVVVU/ptPp1xsbpFKpL6lU6sv8/Pzi/Pz84vz8fCmVSn0B3mUymeVMJvMGKGUymXKH+wOHEVjLHmWUdAAAAABJRU5ErkJggg==',
    },
  ];
}

// TreeTypes configurations for t and r trees
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
  const { appTitle, appDescription, appHomepage } = useAppConfig();
  const navigate = useNavigate();

  // Track if we're in browser environment to avoid SSR/hydration mismatch
  const [isClient, setIsClient] = useState(false);

  // State for controlling the guided tour
  const [isTourOpen, setIsTourOpen] = useState(false);

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
      const savedPageNodeId = getSavedPageNodeId(treeId) || '';
      const path1 = savedPageNodeId ? `/${treeId}/${savedPageNodeId}` : `/${treeId}`;
      const path = `t${path1}`;
      navigate(path);
    },
    [navigate, getSavedPageNodeId],
  );

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          color: 'text.primary',
          fontFamily: 'Roboto, sans-serif',
        }}
      >
        {/* Header with version and user menu */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: '#999999',
            }}
          >
            v1.0.0
          </div>
          <UserLoginButton />
        </div>

        {/* Main content */}
        <TitleLogo
          title={appTitle}
          description={appDescription || undefined}
          showProgress={false}
        />

        {/* TreeTypes selection buttons and Tags button */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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

          <Button
            variant="outlined"
            size="large"
            startIcon={<LocalOfferIcon />}
            onClick={() => navigate('/tags')}
            sx={{
              height: '56px', // Match toggle button height
              px: 3,
              textTransform: 'none',
              borderRadius: 2,
              borderColor: 'divider',
              color: 'text.primary',
              backgroundColor: 'background.paper',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'action.hover',
              },
            }}
          >
            Tags
          </Button>
        </Box>

        {/* Bottom-left corner buttons */}
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '16px',
            display: 'flex',
            flexDirection: 'row',
            gap: '8px',
          }}
        >
          {/* 1. Help/Tour - User onboarding and assistance */}
          <Tooltip title="Open Guided Tour">
            <IconButton
              onClick={() => setIsTourOpen(true)}
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
        </div>
      </Box>

      {/* Guided Tour Component */}
      {isTourOpen && (
        <TopPageGuidedTour
          run={isTourOpen}
          onFinish={() => setIsTourOpen(false)}
        />
      )}
    </>
  );
}
