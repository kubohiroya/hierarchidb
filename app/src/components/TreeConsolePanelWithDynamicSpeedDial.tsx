/**
 * TreeConsolePanelWithDynamicSpeedDial
 *
 * A wrapper component that combines TreeConsolePanel with DynamicSpeedDial
 * to replace hardcoded plugin actions with dynamic plugin loading.
 */

import { Box } from '@mui/material';
import { TreeConsolePanel, type TreeConsolePanelProps, type TreeNodeData } from '@hierarchidb/ui-shell/ui-treeconsole-base';
import { DynamicSpeedDial } from './DynamicSpeedDial.js';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/feature-core/common-types';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/feature-core/common-api';

type TreeConsolePanelWithDynamicSpeedDialProps = Omit<TreeConsolePanelProps, 'onDelete'> & {
  treeId: TreeId | undefined;
  workerClient: Remote<WorkerAPI> | null;
  onStartTour?: () => void;
  pageTreeNode?: TreeNode;
  onBreadcrumbContextAction?: TreeConsolePanelProps['onBreadcrumbContextAction'];
  onTrash?: TreeConsolePanelProps['onDelete'];
  onDelete?: TreeConsolePanelProps['onDelete'];
};

export function TreeConsolePanelWithDynamicSpeedDial({
                                                       treeId,
                                                       workerClient,
                                                       onStartTour,
                                                       pageTreeNode,
                                                       pageNodeId,
                                                       onBreadcrumbContextAction,
                                                       onTrash,
                                                       onDelete,
                                                       ...panelProps
                                                     }: TreeConsolePanelWithDynamicSpeedDialProps) {
  const onContextMenuAction = panelProps.onContextMenuAction ?? (() => {
  });
  const resolvedOnDelete = onDelete ?? onTrash ?? (() => {});
  const parentForSpeedDial = (pageTreeNode?.parentId ?? pageNodeId ?? (treeId ? `${treeId}:root` : 'root')) as string;
  const speedDialContextNode: TreeNodeData = {
    id: (pageNodeId ?? (treeId ? (`${treeId}:root`) : 'root')) as NodeId,
    nodeType: (pageTreeNode?.nodeType ?? 'folder') as NodeType,
    name: pageTreeNode?.name ?? '',
    parentId: parentForSpeedDial as NodeId,
    depth: (pageTreeNode?.depth ?? 1),
  } as TreeNodeData;
  return (
    <Box sx={{ position: 'relative', height: '100%', minHeight: 0 }}>
      {/* TreeConsolePanel without SpeedDial (we'll add our own)
       */}
      <TreeConsolePanel
        {...panelProps}
        treeId={treeId}
        pageNodeId={pageNodeId}
        onStartTour={onStartTour}
        onContextMenuAction={onContextMenuAction}
        onMoveNodes={panelProps.onMoveNodes}
        treeIdForPersistence={treeId}
        onBreadcrumbContextAction={onBreadcrumbContextAction}
        onDelete={resolvedOnDelete}
        renderBuiltInSpeedDial={false}
      />
      {/* Our dynamic SpeedDial that replaces the hardcoded one */}
      <DynamicSpeedDial
        treeId={treeId}
        onCreateAction={(action: string) => onContextMenuAction(action, speedDialContextNode)}
        position={{ bottom: 16, right: 16 }}
        hidden={!panelProps.canCreate}
      />
    </Box>
  );
}
