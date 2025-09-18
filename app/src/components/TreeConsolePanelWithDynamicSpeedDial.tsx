/**
 * TreeConsolePanelWithDynamicSpeedDial
 *
 * A wrapper component that combines TreeConsolePanel with DynamicSpeedDial
 * to replace hardcoded plugin actions with dynamic plugin loading.
 */

import { Box } from '@mui/material';
import { TreeConsolePanel, type TreeConsolePanelProps, type TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import { DynamicSpeedDial } from './DynamicSpeedDial.js';
import type { TreeId } from '@hierarchidb/common-type';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

interface TreeConsolePanelWithDynamicSpeedDialProps extends TreeConsolePanelProps {
  treeId: TreeId | undefined;
  workerClient: Remote<WorkerAPI> | null;
  onStartTour?: () => void;
}

export function TreeConsolePanelWithDynamicSpeedDial({
                                                       treeId,
                                                       workerClient,
                                                       onStartTour,
                                                       ...panelProps
                                                     }: TreeConsolePanelWithDynamicSpeedDialProps) {
  const onContextMenuAction = panelProps.onContextMenuAction ?? (() => {
  });
  return (
    <Box sx={{ position: 'relative', height: '100%', minHeight: 0 }}>
      {/* TreeConsolePanel without SpeedDial (we'll add our own)
       */}
      <TreeConsolePanel
        {...panelProps}
        treeId={treeId}
        onStartTour={onStartTour}
        onContextMenuAction={onContextMenuAction}
        onMoveNodes={panelProps.onMoveNodes}
        treeIdForPersistence={treeId}
        renderBuiltInSpeedDial={false}
      />
      {/* Our dynamic SpeedDial that replaces the hardcoded one */}
      <DynamicSpeedDial
        treeId={treeId}
        onCreateAction={(action: string, node: TreeNodeData) => onContextMenuAction(action, node)}
        position={{ bottom: 16, right: 16 }}
        hidden={!panelProps.canCreate}
      />
    </Box>
  );
}
