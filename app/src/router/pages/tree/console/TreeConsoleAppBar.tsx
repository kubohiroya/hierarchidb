import { useCallback, useMemo } from 'react';
import { toNodeType } from '@hierarchidb/core-types';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import type { OpenMaintenanceContext } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import { AppBar, Box, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import AppLogoIcon from '~/components/AppLogoIcon';
import { useWorker } from '~/contexts/WorkerProvider';
import { BuildSessionQueueBadgeButton, type BuildSessionQueueEntry } from '~/components/BuildSessionQueueList';
import { UserLoginButton } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';
import { startBuildFlow } from '~/router/pages/tree/console/buildFlow';
import { openInNewTab } from '~/utils/openInNewTab';

type TreeConsoleAppBarProps = {
  data: LoadPageNodeReturn;
  pageName: string;
  isUserMenuReady: boolean;
  onGoHome: () => void;
  onOpenMaintenance: (context: OpenMaintenanceContext) => void;
};

export function TreeConsoleAppBar({
  data,
  pageName,
  isUserMenuReady,
  onGoHome,
  onOpenMaintenance,
}: TreeConsoleAppBarProps) {
  const navigate = useNavigate();
  const { client: workerClient } = useWorker();
  const location = useRouterState({ select: (state) => state.location });
  const returnTo = useMemo(() => `${location.pathname}${location.searchStr ?? ''}`,
    [location.pathname, location.searchStr]
  );

  const handleNavigateToBuild = useCallback(async (entry: BuildSessionQueueEntry, options?: { openInNewTab?: boolean }) => {
    if (!data.tree?.id || !data.pageNodeId || !workerClient) return;
    const targetNode = entry.node
      ?? await workerClient.getQueryAPI().then((queryAPI) => queryAPI.getNode(entry.session.nodeId)).catch(() => null);

    if (!targetNode) {
      return;
    }

    await startBuildFlow({
      treeId: data.tree.id,
      pageNodeId: data.pageNodeId,
      node: targetNode,
      returnTo,
      workerClient,
      navigate: (to) => {
        if (options?.openInNewTab) {
          openInNewTab(to);
          return;
        }
        navigate({ to });
      },
    });
  }, [data.pageNodeId, data.tree?.id, navigate, returnTo, workerClient]);

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <IconButton
          onClick={onGoHome}
          edge="start"
          color="primary"
          aria-label="Go to HierarchiDB home"
          sx={{ marginLeft: '-20px' }}
        >
          <AppLogoIcon size={28} />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
          {pageName}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={1} alignItems="center">
          {data.tree?.id ? (
            <BuildSessionQueueBadgeButton
              nodeType={toNodeType('shape')}
              onNavigateToBuild={handleNavigateToBuild}
            />
          ) : null}
          {isUserMenuReady ? (
            <Box sx={{ ml: '8px' }}>
              <UserLoginButton onOpenMaintenance={onOpenMaintenance} />
            </Box>
          ) : null}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
