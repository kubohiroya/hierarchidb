import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import type { Remote } from 'comlink';
import { useCallback } from 'react';
import { convertTreeNodeToTreeNodeData } from '~/utils/treeNodeConverter.js';
import { logIntegrationWarning } from './treeConsoleIntegrationUtils.js';

type IntegrationActions = {
  handleEdit?: (() => void) | null;
  handleContextMenuAction: (
    action: string,
    node: HierarchicalTreeNode,
    options?: { navigateToParent?: boolean }
  ) => void;
};

export function useTreeConsoleResumeDialog({
  client,
  actions,
}: {
  client?: Remote<WorkerAPI>;
  actions: IntegrationActions;
}): {
  requestEdit: (targetNodeId?: NodeId, nodeHint?: HierarchicalTreeNode | TreeNode) => Promise<void>;
} {
  const requestEdit = useCallback(
    async (targetNodeId?: NodeId, nodeHint?: HierarchicalTreeNode | TreeNode) => {
      if (!client || !targetNodeId) {
        actions.handleEdit?.();
        return;
      }
      try {
        const queryAPI = await client.getQueryAPI();
        const target = await queryAPI.getNode(targetNodeId);
        const sourceNode = (target as TreeNode | undefined) ?? (nodeHint as TreeNode | undefined);
        if (!sourceNode) {
          actions.handleEdit?.();
          return;
        }
        const nodeData = convertTreeNodeToTreeNodeData(sourceNode);
        actions.handleContextMenuAction('edit', nodeData, { navigateToParent: false });
      } catch (error) {
        logIntegrationWarning('Failed to check draft atoms before edit', error);
        actions.handleEdit?.();
      }
    },
    [actions, client]
  );

  return {
    requestEdit,
  };
}
