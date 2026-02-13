import type { TreeConfig } from '@hierarchidb/ui-plugin-shell/components';
import { TreeToggleButtonGroup } from '@hierarchidb/ui-plugin-shell/components';
import {
  type OpenMaintenanceContext,
  UserLoginButton,
} from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import {
  Extension as ExtensionIcon,
  Folder,
  GitHub as GitHubIcon,
  HelpOutline as HelpOutlineIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import { useMemo } from 'react';
import { loadAppConfig, resolveAssetHref } from '~/loadAppConfig.js';
import { createMaintenanceSessionUrl } from '~/maintenance/maintenanceSession.js';
import { APP_VERSION, BUILD_TIME } from '../../../version.ts';
import { TitleLogo } from './TitleLogo.js';
import { TopPageGuidedTour } from './tour/TopPageGuidedTour.js';
import { useHomePage } from './useHomePage.js';

export function meta() {
  const { appPrefix, appFavicon, appTitle, appDescription } = loadAppConfig();
  const faviconHref = resolveAssetHref(appPrefix, appFavicon);
  return [
    { title: appTitle },
    { name: 'description', content: appDescription },
    {
      tagName: 'link',
      rel: 'icon',
      type: 'image/svg+xml',
      href: faviconHref,
    },
  ];
}

const formatBuildTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const pad2 = (input: number) => String(input).padStart(2, '0');
  return [
    `${parsed.getFullYear()}/${pad2(parsed.getMonth() + 1)}/${pad2(parsed.getDate())}`,
    `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`,
  ].join(' ');
};

const treeButtonConfigs: TreeConfig[] = [
  {
    id: 'r',
    label: 'Resources',
    icon: Folder,
    routePath: 'r',
    color: 'primary',
    tooltip: 'Navigate to Resources view',
  },
];

export default function HomePage() {
  const {
    appDescription,
    appTitle,
    githubHref,
    handleNavigateToInfo,
    handleNavigateToPluginLoaders,
    handleTreeSelect,
    isTourOpen,
    isUserMenuReady,
    setIsTourOpen,
    getSavedPageNodeId,
    savePageNodeId,
  } = useHomePage();

  const githubButton = useMemo(() => {
    if (!githubHref) return null;
    return (
      <Tooltip title="View Source on GitHub">
        <IconButton
          href={githubHref}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          sx={{ color: 'text.secondary', '&:hover': { backgroundColor: 'action.hover' } }}
        >
          <GitHubIcon />
        </IconButton>
      </Tooltip>
    );
  }, [githubHref]);

  const handleOpenMaintenance = (context: OpenMaintenanceContext) => {
    if (typeof window === 'undefined') return;
    const { url } = createMaintenanceSessionUrl({
      expectedEmail: context.userEmail,
    });
    window.location.assign(url);
  };

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
          <div style={{ fontSize: '12px', color: '#999999' }}>
            v{APP_VERSION} ({formatBuildTime(BUILD_TIME)})
          </div>
          {isUserMenuReady ? (
            <Box data-tour-id="home-user-menu">
              <UserLoginButton onOpenMaintenance={handleOpenMaintenance} />
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
              onClick={handleNavigateToInfo}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { backgroundColor: 'action.hover' } }}
            >
              <InfoIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Plugin Registry">
            <IconButton
              onClick={handleNavigateToPluginLoaders}
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
