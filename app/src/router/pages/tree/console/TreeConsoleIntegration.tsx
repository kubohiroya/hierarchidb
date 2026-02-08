/**
 * TreeConsole Integration Component
 *
 * Integrates TreeConsolePanel with WorkerAPIClient for console data management.
 * Avoids Orchestrated APIs as requested and focuses on direct Worker API calls.
 */

import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { TreeConsolePanel } from '@hierarchidb/ui-treeconsole-base';
import { TreeConsoleToolbar } from '@hierarchidb/ui-treeconsole-toolbar';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useEffect } from 'react';
import { useWorker } from '~/contexts/WorkerProvider.tsx';
import { DynamicSpeedDial } from './DynamicSpeedDial.js';
import { useTreeConsoleSpeedDial } from './useTreeConsoleSpeedDial.js';
import { TreeNodeInfoPanel } from './TreeNodeInfoPanel.js';
import { canImportFromNode } from './treeConsoleIntegrationUtils.js';
import { useTreeConsoleIntegrationInner } from './useTreeConsoleIntegrationInner.js';

export interface TreeConsoleIntegrationProps {
  readonly treeId?: string;
  readonly pageNodeId?: NodeId;
  readonly pageTreeNode?: TreeNode;
}

export const TreeConsoleIntegration: React.FC<TreeConsoleIntegrationProps> = ({
  treeId,
  pageNodeId,
  pageTreeNode,
}) => {
  const { client, isConnected, reset, initialize } = useWorker();
  const {
    workerLoading,
    workerError,
    shouldRenderTreeTable,
    isDialogRoute,
    speedDialSuppressed,
    setSpeedDialSuppressed,
    toolbarProps,
    treeConsolePanelProps,
    breadcrumbProps,
    infoPanelProps,
  } = useTreeConsoleIntegrationInner({
    client: client ?? undefined,
    treeId,
    pageNodeId,
    pageTreeNode,
    resetWorker: reset,
    initializeWorker: initialize,
  });

  const speedDial = useTreeConsoleSpeedDial({
    treeId,
    pageNodeId,
    pageTreeNode,
    onContextMenuAction: treeConsolePanelProps.onContextMenuAction,
    canCreate: treeConsolePanelProps.canCreate,
    isDialogRoute,
    speedDialSuppressed,
    setSpeedDialSuppressed,
  });
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug('[TreeConsoleIntegration] mount', { treeId, pageNodeId });
    return () => {
      console.debug('[TreeConsoleIntegration] unmount', { treeId, pageNodeId });
    };
  }, [pageNodeId, treeId]);

  if (workerLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (workerError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Failed to initialize TreeConsole: {String(workerError)}</Alert>
      </Box>
    );
  }

  if (!isConnected || !client) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <TreeConsoleToolbar {...toolbarProps} />
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {shouldRenderTreeTable ? (
          <>
            {speedDial.guidedTour}
            <TreeConsolePanel
              {...treeConsolePanelProps}
              infoPanel={<TreeNodeInfoPanel {...infoPanelProps} />}
              onContextMenuAction={speedDial.onContextMenuAction}
              treeIdForPersistence={treeConsolePanelProps.treeId}
              renderBuiltInSpeedDial={false}
            />
            <DynamicSpeedDial
              treeId={treeConsolePanelProps.treeId as TreeId | undefined}
              onCreateAction={(action: string, _, options) =>
                speedDial.onContextMenuAction(action, speedDial.speedDialContextNode, options)
              }
              position={{ bottom: 16, right: 16 }}
              hidden={speedDial.hideSpeedDial}
              onSuppress={speedDial.suppressSpeedDial}
            />
          </>
        ) : (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <TreeConsoleBreadcrumb {...breadcrumbProps} />
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <TreeNodeInfoPanel {...infoPanelProps} />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export { canImportFromNode };
