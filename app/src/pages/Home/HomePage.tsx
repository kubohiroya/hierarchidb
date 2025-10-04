import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { AccountTree, Folder } from '@mui/icons-material';
import { Info as InfoIcon, GitHub as GitHubIcon, HelpOutline as HelpOutlineIcon, Extension as ExtensionIcon, LocalOffer as LocalOfferIcon } from '@mui/icons-material';
import type { TreeConfig } from '@hierarchidb/ui-core';
import { TreeToggleButtonGroup } from '@hierarchidb/ui-core';
import { TitleLogo } from '../../components/TitleLogo.js';
import { useAppConfig } from '~/contexts/AppConfigContext.js';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';
import { TopPageGuidedTour } from '@hierarchidb/runtime-ui-tour';
import { loadAppConfig, resolveAssetHref } from '~/loadAppConfig.js';
import { useNavigate } from '@tanstack/react-router';

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
  ];
}

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

export default function HomePage() {
  const navigate = useNavigate();
  const { appTitle, appDescription, appHomepage } = useAppConfig();
  const [isUserMenuReady, setUserMenuReady] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  useEffect(() => {
    setUserMenuReady(true);
    setIsClient(true);
  }, []);

  const getSessionStorageKey = useCallback((treeId: string) => `lastPageNodeId_${treeId}`, []);

  const getSavedPageNodeId = useCallback(
    (treeId: string): string | null => {
      if (!isClient) return null;
      try {
        return sessionStorage.getItem(getSessionStorageKey(treeId));
      } catch {
        return null;
      }
    },
    [isClient, getSessionStorageKey],
  );

  const savePageNodeId = useCallback(
    (treeId: string, pageNodeId: string) => {
      if (!isClient) return;
      try {
        sessionStorage.setItem(getSessionStorageKey(treeId), pageNodeId);
      } catch {
        /* ignore */
      }
    },
    [isClient, getSessionStorageKey],
  );

  const handleTreeSelect = useCallback(
    (treeId: string) => {
      const savedPageNodeId = getSavedPageNodeId(treeId) || '';
      const path = savedPageNodeId ? `/t/${treeId}/${savedPageNodeId}` : `/t/${treeId}`;
      navigate({ to: path });
    },
    [getSavedPageNodeId, navigate],
  );

  const githubButton = useMemo(() => {
    if (!appHomepage) return null;
    return (
      <Tooltip title="View Source on GitHub">
        <IconButton
          href={appHomepage}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          sx={{ color: 'text.secondary', '&:hover': { backgroundColor: 'action.hover' } }}
        >
          <GitHubIcon />
        </IconButton>
      </Tooltip>
    );
  }, [appHomepage]);

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
          <div style={{ fontSize: '12px', color: '#999999' }}>v1.0.0</div>
          {isUserMenuReady ? <UserLoginButton /> : null}
        </div>

        <TitleLogo title={appTitle} description={appDescription || undefined} showProgress={false} />

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
            onClick={() => navigate({ to: '/tags' })}
            sx={{
              height: '56px',
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
          <Tooltip title="Open Guided Tour">
            <IconButton
              onClick={() => setIsTourOpen(true)}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { backgroundColor: 'action.hover' } }}
            >
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="License Information">
            <IconButton
              onClick={() => navigate({ to: '/info' })}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { backgroundColor: 'action.hover' } }}
            >
              <InfoIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Plugin Registry">
            <IconButton
              onClick={() => navigate({ to: '/plugins' })}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { backgroundColor: 'action.hover' } }}
            >
              <ExtensionIcon />
            </IconButton>
          </Tooltip>

          {githubButton}
        </div>
      </Box>

      {isTourOpen && (
        <TopPageGuidedTour run={isTourOpen} onFinish={() => setIsTourOpen(false)} />
      )}
    </>
  );
}
