import { useMemo } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { LoadNodeActionReturn, LoadTargetNodeReturn } from '~/router/loaders/treeLoaders';

type TreeDialogMatchData = {
  kind?: 'archive' | 'plugin';
  data?: unknown;
  params?: { action?: string; nodeType?: string };
};

export type TargetContextState = {
  targetNodeId: NodeId | null;
  targetNode: TreeNode | null;
  targetNodeType: string | null;
};

export function useTreeTargetContextState(
  dialogMatchData: unknown,
  targetMatchData: unknown
): TargetContextState {
  return useMemo<TargetContextState>(() => {
    const dialogData = dialogMatchData as TreeDialogMatchData | undefined;
    if (dialogData?.kind === 'plugin') {
      const pluginData = dialogData.data as
        | (LoadNodeActionReturn & { params?: { targetNodeId?: string; nodeType?: string } })
        | undefined;
      const pluginTargetNodeId = pluginData?.targetNodeId ?? pluginData?.params?.targetNodeId;
      return {
        targetNodeId: pluginTargetNodeId ? (pluginTargetNodeId as NodeId) : null,
        targetNode: pluginData?.targetNode ?? null,
        targetNodeType: pluginData?.nodeType ?? pluginData?.params?.nodeType ?? null,
      };
    }

    const targetData = targetMatchData as LoadTargetNodeReturn | undefined;
    return {
      targetNodeId: targetData?.targetNodeId ?? null,
      targetNode: targetData?.targetNode ?? null,
      targetNodeType: targetData?.targetNode?.nodeType ?? null,
    };
  }, [dialogMatchData, targetMatchData]);
}
