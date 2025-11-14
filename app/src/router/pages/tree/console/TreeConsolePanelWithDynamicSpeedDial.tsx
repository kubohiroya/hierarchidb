/**
 * TreeConsolePanelWithDynamicSpeedDial
 *
 * A wrapper component that combines TreeConsolePanel with DynamicSpeedDial
 * to replace hardcoded plugin actions with dynamic plugin loading.
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-types';
import {
  TreeConsolePanel,
  type TreeConsolePanelProps,
  type TreeNodeData,
} from '@hierarchidb/ui-treeconsole-base';
import { Box } from '@mui/material';
import type { Remote } from 'comlink';
import { DynamicSpeedDial } from './DynamicSpeedDial.js';
import { useCallback, useMemo, useState, useEffect } from 'react';

import { ProjectsGuidedTour } from '../tour/ProjectsGuidedTour.tsx';
import { ResourcesGuidedTour } from '../tour/ResourcesGuidedTour.tsx';
//import { TopPageGuidedTour } from '../tour/TopPageGuidedTour.tsx';

// Select the appropriate tour based on the current path

type TreeConsolePanelWithDynamicSpeedDialProps = Omit<TreeConsolePanelProps, 'onDelete'> & {
  treeId: TreeId | undefined;
  workerClient: Remote<WorkerAPI> | null;
  onStartTour?: () => void;
  pageTreeNode?: TreeNode;
  onBreadcrumbContextAction?: TreeConsolePanelProps['onBreadcrumbContextAction'];
  onTrash?: TreeConsolePanelProps['onDelete'];
  onDelete?: TreeConsolePanelProps['onDelete'];
  speedDialSuppressed: boolean;
  setSpeedDialSuppressed: (value: boolean) => void;
  isDialogRoute: boolean;
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
  speedDialSuppressed,
  setSpeedDialSuppressed,
  isDialogRoute,
  ...panelProps
}: TreeConsolePanelWithDynamicSpeedDialProps) {
  const [tourRun, setTourRun] = useState(false);
  // Handler for starting guided tour

  const handleTourFinish = useCallback(() => {
    setTourRun(false);
  }, []);

  useEffect(() => {
    if (isDialogRoute) {
      setSpeedDialSuppressed(true);
    } else {
      setSpeedDialSuppressed(false);
    }
  }, [isDialogRoute, setSpeedDialSuppressed]);

  const guidedTour = useMemo(() => {
    if (treeId === 'p') {
      return <ProjectsGuidedTour run={tourRun} onFinish={handleTourFinish} />;
    } else if (treeId === 'r') {
      return <ResourcesGuidedTour run={tourRun} onFinish={handleTourFinish} />;
    }
  }, [handleTourFinish, tourRun, treeId]);

  const rawContextAction = useMemo(()=>panelProps.onContextMenuAction ?? (() => {}), [panelProps.onContextMenuAction]);
  const onContextMenuAction = useCallback(
    (action: string, node: TreeNodeData) => {
      if (action?.startsWith('create:')) {
        setSpeedDialSuppressed(true);
      }
      rawContextAction(action, node);
    },
    [rawContextAction, setSpeedDialSuppressed]
  );
  const resolvedOnDelete = onDelete ?? onTrash ?? (() => {});
  const parentForSpeedDial = (pageTreeNode?.parentId ??
    pageNodeId ??
    (treeId ? `${treeId}:root` : 'root')) as string;
  const speedDialContextNode: TreeNodeData = {
    id: (pageNodeId ?? (treeId ? `${treeId}:root` : 'root')) as NodeId,
    nodeType: (pageTreeNode?.nodeType ?? 'folder') as NodeType,
    name: pageTreeNode?.name ?? '',
    parentId: parentForSpeedDial as NodeId,
    depth: pageTreeNode?.depth ?? 1,
  } as TreeNodeData;
  return (
    <Box sx={{ position: 'relative', height: '100%', minHeight: 0 }}>
      {guidedTour}
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
        hidden={!panelProps.canCreate || isDialogRoute || speedDialSuppressed}
        onSuppress={() => setSpeedDialSuppressed(true)}
      />
    </Box>
  );
}