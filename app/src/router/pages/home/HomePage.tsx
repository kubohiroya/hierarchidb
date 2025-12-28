import type { TreeConfig } from '@hierarchidb/ui-plugin-shell/components';
import { TreeToggleButtonGroup } from '@hierarchidb/ui-plugin-shell/components';
import { UserLoginButton } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import {
  Extension as ExtensionIcon,
  Folder,
  GitHub as GitHubIcon,
  HelpOutline as HelpOutlineIcon,
  Info as InfoIcon,
  LocalOffer as LocalOfferIcon,
} from '@mui/icons-material';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TopPageGuidedTour } from './tour/TopPageGuidedTour.js';
import { useAppConfig } from '~/contexts/AppConfigContext.js';
import { loadAppConfig, resolveAssetHref } from '~/loadAppConfig.js';
import { TitleLogo } from './TitleLogo.js';

export function meta() {
  const { appPrefix, appFavicon } = loadAppConfig();
  const faviconHref = resolveAssetHref(appPrefix, appFavicon);
  return [
    { title: 'HierarchiDB' },
    { name: 'description', content: 'High-performance console-structured data management framework' },
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
    label: 'Resoruces',
    icon: Folder,
    routePath: 'r',
    color: 'primary',
    tooltip: 'Navigate to Resources view',
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
    [isClient, getSessionStorageKey]
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
    [isClient, getSessionStorageKey]
  );

  const handleTreeSelect = useCallback(
    (treeId: string) => {
      const savedPageNodeId = getSavedPageNodeId(treeId) || '';
      const path = savedPageNodeId ? `/t/${treeId}/${savedPageNodeId}` : `/t/${treeId}`;
      navigate({ to: path });
    },
    [getSavedPageNodeId, navigate]
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
          {isUserMenuReady ? (
            <Box data-tour-id="home-user-menu">
              <UserLoginButton />
            </Box>
          ) : null}
        </div>

        <TitleLogo
          title={appTitle}
          description={appDescription || undefined}
          showProgress={false}
        />

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box data-tour-id="home-tree-toggle">
            <TreeToggleButtonGroup
              trees={treeButtonConfigs}
              selectedTreeId={null}
              getSavedPageNodeId={getSavedPageNodeId}
              savePageNodeId={savePageNodeId}
              onTreeSelect={handleTreeSelect}
              orientation="horizontal"
              size="large"
              sx={{
                backgroundColor: 'transparent',
                borderRadius: 2,
                p: 1,
                '& .MuiButton-root': {
                  height: '84px',
                  px: 4.5,
                  textTransform: 'none',
                  borderRadius: 2,
                  borderColor: 'divider',
                  color: 'text.primary',
                  backgroundColor: 'background.paper',
                  fontSize: '1.1rem',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'action.hover',
                  },
                },
              }}
            />
          </Box>

          <Button
            data-tour-id="home-tags-button"
            variant="outlined"
            size="large"
            startIcon={<LocalOfferIcon />}
            onClick={() => navigate({ to: '/tags' })}
            sx={{
              height: '84px',
              px: 4.5,
              textTransform: 'none',
              borderRadius: 2,
              borderColor: 'divider',
              color: 'text.primary',
              backgroundColor: 'background.paper',
              fontSize: '1.1rem',
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
              data-tour-id="home-help-button"
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
              onClick={() => navigate({ to: '/plugin-loaders' })}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { backgroundColor: 'action.hover' } }}
            >
              <ExtensionIcon />
            </IconButton>
          </Tooltip>

          {githubButton}
        </div>
      </Box>

      {isTourOpen && <TopPageGuidedTour run={isTourOpen} onFinish={() => setIsTourOpen(false)} />}
    </>
  );
}
