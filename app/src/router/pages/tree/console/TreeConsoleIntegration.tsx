/**
 * TreeConsole Integration Component
 *
 * Integrates TreeConsolePanel with WorkerAPIClient for console data management.
 * Avoids Orchestrated APIs as requested and focuses on direct Worker API calls.
 */

import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import { TreeConsoleToolbar } from '@hierarchidb/ui-treeconsole-toolbar';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useWorker } from '~/contexts/WorkerProvider.tsx';
import { TreeConsolePanelWithDynamicSpeedDial } from './TreeConsolePanelWithDynamicSpeedDial.js';
import { TreeNodeInfoPanel } from './TreeNodeInfoPanel.js';
import { useTreeConsoleIntegrationInner } from './useTreeConsoleIntegrationInner.js';
import { canImportFromNode } from './treeConsoleIntegrationUtils.js';

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
          <TreeConsolePanelWithDynamicSpeedDial
            {...treeConsolePanelProps}
            infoPanel={<TreeNodeInfoPanel {...infoPanelProps} />}
            speedDialSuppressed={speedDialSuppressed}
            setSpeedDialSuppressed={setSpeedDialSuppressed}
            isDialogRoute={isDialogRoute}
          />
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
