import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { Remote } from 'comlink';
import { useCallback, useState } from 'react';
import { convertTreeNodeToTreeNodeData } from '~/utils/treeNodeConverter.js';
import { logIntegrationWarning } from './treeConsoleIntegrationUtils.js';

type IntegrationActions = {
  handleEdit?: (() => void) | null;
  handleContextMenuAction: (action: string, node: TreeNodeData, options?: { navigateToParent?: boolean }) => void;
};

type ResumeDialogState = {
  open: boolean;
  nodeId: NodeId | null;
  nodeName: string;
  node?: TreeNode;
};

export type ResumeDialogController = {
  resumeDialogProps: {
    open: boolean;
    nodeName: string;
    onCancel: () => void;
    onStartFresh: () => void;
    onResumePrevious: () => void;
  };
  requestEdit: (targetNodeId?: NodeId, nodeHint?: TreeNodeData | TreeNode) => Promise<void>;
};

export function useTreeConsoleResumeDialog({
  workerClient,
  actions,
}: {
  workerClient: Remote<WorkerAPI>;
  actions: IntegrationActions;
}): ResumeDialogController {
  const [resumeDialog, setResumeDialog] = useState<ResumeDialogState>({
    open: false,
    nodeId: null,
    nodeName: '',
  });
  const [pendingEditNav, setPendingEditNav] = useState<null | (() => void)>(null);

  const handleResumeDialogClose = useCallback(() => {
    setResumeDialog({ open: false, nodeId: null, nodeName: '' });
    setPendingEditNav(null);
  }, []);

  const triggerPendingEditNavigation = useCallback(() => {
    const fn = pendingEditNav;
    setPendingEditNav(null);
    setResumeDialog({ open: false, nodeId: null, nodeName: '' });
    fn?.();
  }, [pendingEditNav]);

  const handleStartFreshDraft = useCallback(async () => {
    if (resumeDialog.nodeId && workerClient) {
      try {
        const queryAPI = await workerClient.getQueryAPI();
        const updaterAPI = await workerClient.getTreeNodeUpdaterAPI();
        const node = resumeDialog.node ?? (await queryAPI.getNode(resumeDialog.nodeId));
        if (node) {
          const nextDraftMetadata = node.metadata ?? { name: '', description: '', tags: [] };
          const rawDraftData = (node as any).draftData ?? (node as any).data ?? {};
          const nextDraftData = (rawDraftData ?? {}) as Record<string, unknown>;
          await updaterAPI.updateTreeNodeDraftMetadata(resumeDialog.nodeId, nextDraftMetadata);
          await updaterAPI.updateTreeNodeDraftData(resumeDialog.nodeId, nextDraftData);
        }
      } catch (error) {
        logIntegrationWarning('Failed to seed fresh draft before edit', error);
      }
    }
    triggerPendingEditNavigation();
  }, [resumeDialog.node, resumeDialog.nodeId, triggerPendingEditNavigation, workerClient]);

  const handleResumePreviousDraft = useCallback(() => {
    triggerPendingEditNavigation();
  }, [triggerPendingEditNavigation]);

  const requestEdit = useCallback(
    async (targetNodeId?: NodeId, nodeHint?: TreeNodeData | TreeNode) => {
      if (!workerClient || !targetNodeId) {
        actions.handleEdit?.();
        return;
      }
      try {
        const queryAPI = await workerClient.getQueryAPI();
        const target = await queryAPI.getNode(targetNodeId);
        const sourceNode = (target as TreeNode | undefined) ?? (nodeHint as TreeNode | undefined);
        if (!sourceNode) {
          actions.handleEdit?.();
          return;
        }
        const nodeData = convertTreeNodeToTreeNodeData(sourceNode);
        const navigateToEdit = () =>
          actions.handleContextMenuAction('edit', nodeData, { navigateToParent: false });
        const hasDraft = Boolean((target as any)?.draftData) || Boolean((target as any)?.draftMetadata);
        if (hasDraft) {
          setResumeDialog({
            open: true,
            nodeId: targetNodeId,
            nodeName: target?.metadata?.name ?? '',
            node: target ?? (nodeHint as TreeNode | undefined),
          });
          setPendingEditNav(() => navigateToEdit);
          return;
        }
        navigateToEdit();
      } catch (error) {
        logIntegrationWarning('Failed to check draft state before edit', error);
        actions.handleEdit?.();
      }
    },
    [actions, workerClient]
  );

  return {
    resumeDialogProps: {
      open: resumeDialog.open,
      nodeName: resumeDialog.nodeName,
      onCancel: handleResumeDialogClose,
      onStartFresh: handleStartFreshDraft,
      onResumePrevious: handleResumePreviousDraft,
    },
    requestEdit,
  };
}
