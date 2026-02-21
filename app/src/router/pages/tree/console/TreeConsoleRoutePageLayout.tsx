import type { OpenMaintenanceContext } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import { Box, CircularProgress } from '@mui/material';
import { Outlet } from '@tanstack/react-router';
import { Suspense, type ReactNode } from 'react';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';
import { NodeNotFoundDialog } from './NodeNotFoundDialog';
import { TreeConsoleAppBar } from './TreeConsoleAppBar';

type TreeConsoleRoutePageLayoutProps = {
  data: LoadPageNodeReturn;
  pageName: string;
  isUserMenuReady: boolean;
  nodeNotFound: boolean;
  notFoundOpen: boolean;
  onGoToTreeRoot: () => void;
  onGoToTreeRootWithReplace: () => void;
  onGoHome: () => void;
  onOpenMaintenance: (context: OpenMaintenanceContext) => void;
  children: ReactNode;
};

export function TreeConsoleRoutePageLayout({
  data,
  pageName,
  isUserMenuReady,
  nodeNotFound,
  notFoundOpen,
  onGoToTreeRoot,
  onGoToTreeRootWithReplace,
  onGoHome,
  onOpenMaintenance,
  children,
}: TreeConsoleRoutePageLayoutProps) {
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TreeConsoleAppBar
        data={data}
        pageName={pageName}
        isUserMenuReady={isUserMenuReady}
        onGoHome={onGoHome}
        onOpenMaintenance={onOpenMaintenance}
      />

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {nodeNotFound ? (
          <NodeNotFoundDialog
            open={notFoundOpen}
            pageNodeId={data.pageNodeId}
            onClose={onGoToTreeRoot}
            onGoToTreeRoot={onGoToTreeRootWithReplace}
          />
        ) : (
          <>
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              }
            >
              {children}
            </Suspense>
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </>
        )}
      </Box>
    </Box>
  );
}
