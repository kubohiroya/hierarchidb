/**
 * Edit/preview dialog helpers for TreeConsole.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { composeStepConfigs } from '@hierarchidb/plugin-base';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import { DualKeyMap } from '@hierarchidb/util';
import { loadUIPlugin } from '~/plugin-loaders/ui-plugin-loader';
import type { TreeConsoleActionDeps } from '~/hooks/treeconsole/types';
import { showCommandError } from './treeConsoleActionUtils.ts';
import { openInNewTab } from '~/utils/openInNewTab';

export const PREVIEW_GUARD_NODE_TYPES = new Set([
  'basemap',
  'shape',
  'location',
  'route',
  'spreadsheet',
  'styler',
]);

export const PREVIEW_GUARD_MESSAGE = '表示のための設定および処理が完了していません';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasLocationSelection = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return Object.values(value).some((row) => Array.isArray(row) && row.some(Boolean));
};

const canStartLocationProcessing = (data: Record<string, unknown>, nodeId?: NodeId): boolean => {
  if (!nodeId) return false;
  const dataSource = typeof data.dataSource === 'string' ? data.dataSource : '';
  if (dataSource !== 'ide-gsm') return false;
  const ideGsmSources = Array.isArray(data.ideGsmSources) ? data.ideGsmSources : [];
  const hasSourceUrl =
    typeof data.ideGsmSourceUrl === 'string' && data.ideGsmSourceUrl.trim().length > 0;
  const hasSources = ideGsmSources.length > 0 || hasSourceUrl;
  const hasSelection = hasLocationSelection(data.selectedArrayByCountries);
  return hasSources && hasSelection;
};

const isProcessingStatus = (data: Record<string, unknown>): boolean =>
  data.processingStatus === 'processing';

export const resolvePreviewGuardState = async ({
  client,
  nodeType,
  nodeId,
}: {
  client: TreeConsoleActionDeps['client'];
  nodeType: string;
  nodeId: NodeId;
}): Promise<{ canOpen: boolean; finalStepIndex?: number }> => {
  const normalizedNodeType = nodeType.toLowerCase();
  if (!PREVIEW_GUARD_NODE_TYPES.has(normalizedNodeType)) {
    return { canOpen: true };
  }

  await loadUIPlugin(normalizedNodeType).catch(() => false);
  let mergedData: Record<string, unknown> = {};
  let nodeSnapshot: TreeNode | undefined;
  try {
    const updaterAPI = await client?.getTreeNodeUpdaterAPI();
    nodeSnapshot = await updaterAPI?.getTreeNode(nodeId);
    const baseData = isRecord(nodeSnapshot?.data) ? nodeSnapshot?.data : {};
    const draftData = isRecord(nodeSnapshot?.draftData) ? nodeSnapshot?.draftData : {};
    mergedData = { ...baseData, ...draftData };
  } catch (error) {
    console.warn('[TreeConsoleActions] failed to read draft data for preview guard', error);
  }

  const composed = composeStepConfigs(normalizedNodeType, 'edit', mergedData);
  const configs = composed.configs ?? [];
  if (!configs.length) {
    return { canOpen: true };
  }

  const results = await Promise.all(
    configs.map(async (cfg) => {
      if (!cfg.validate) return true;
      try {
        return Boolean(await Promise.resolve(cfg.validate(mergedData)));
      } catch {
        return false;
      }
    })
  );

  const finalConfigIndex = configs.length - 1;
  const basicInfoValid = composed.hasHostBase
    ? true
    : Boolean(String(nodeSnapshot?.draftMetadata?.name ?? nodeSnapshot?.metadata?.name ?? '').trim());
  const requiredBeforeFinalValid =
    basicInfoValid && configs.slice(0, finalConfigIndex).every((cfg, idx) => cfg.optional || results[idx]);
  const finalStepValid = results[finalConfigIndex] ?? true;
  const finalStepIndex = composed.hasHostBase ? finalConfigIndex + 1 : finalConfigIndex + 2;
  const canStartProcessing =
    normalizedNodeType === 'location' &&
    requiredBeforeFinalValid &&
    (isProcessingStatus(mergedData) || canStartLocationProcessing(mergedData, nodeId));
  return {
    canOpen: requiredBeforeFinalValid && (finalStepValid || canStartProcessing),
    finalStepIndex,
  };
};

export const createDialogHelpers = (deps: TreeConsoleActionDeps) => {
  const { client, treeId, pageNodeId, pageTreeNode, pushPath, ssot } = deps;

  const openEditDialog = async (
    targetNodeId: NodeId,
    nodeHint?: HierarchicalTreeNode | TreeNode,
    dialogOptions?: {
      initialStep?: number;
      displayMode?: 'full' | 'normal';
      action?: 'edit' | 'preview';
      openInNewTab?: boolean;
    }
  ) => {
    if (!client || !pushPath || !treeId) {
      return;
    }

    const nodeIndex = ssot.nodeIndex ?? new DualKeyMap<NodeId, NodeId, TreeNode>();
    const nodeRecord = nodeIndex.get(targetNodeId);
    const hintedType =
      (nodeRecord as { nodeType?: string; type?: string } | undefined)?.nodeType ??
      (nodeRecord as { type?: string } | undefined)?.type ??
      (nodeHint as { nodeType?: string } | undefined)?.nodeType ??
      (nodeHint as { type?: string } | undefined)?.type ??
      (pageTreeNode && pageTreeNode.id === targetNodeId ? pageTreeNode.nodeType : undefined);
    const nodeType = String(hintedType ?? 'folder');

    try {
      const queryAPI = await client.getQueryAPI();

      const node = await queryAPI.getNode(targetNodeId);
      if (!node) {
        showCommandError('INVALID_OPERATION', 'Target node does not exist');
        return;
      }

      const hintedParent =
        nodeRecord?.parentId ??
        (nodeHint as { parentId?: NodeId | null } | undefined)?.parentId ??
        (pageTreeNode && pageTreeNode.id === targetNodeId ? pageTreeNode.parentId : undefined);
      const parentForRoute: NodeId = (() => {
        if (pageNodeId) return pageNodeId as NodeId;
        if (hintedParent) return hintedParent as NodeId;
        return targetNodeId;
      })();

      const canonicalId =
        (nodeRecord as { holderTargetId?: NodeId } | undefined)?.holderTargetId ??
        (nodeHint as { holderTargetId?: NodeId } | undefined)?.holderTargetId ??
        targetNodeId;

      const action = dialogOptions?.action ?? 'edit';
      const basePath = `/t/${treeId}/${parentForRoute}/${canonicalId}/${nodeType}/${action}`;
      const mode = dialogOptions?.displayMode ?? 'normal';
      const step = dialogOptions?.initialStep ?? 1;
      const nextUrl = `${basePath}/${mode}/${step}`;
      if (dialogOptions?.openInNewTab) {
        openInNewTab(nextUrl);
      } else {
        pushPath(nextUrl);
      }
    } catch (error) {
      console.error('Failed to launch edit dialog:', error);
      showCommandError('UNKNOWN_ERROR', error instanceof Error ? error.message : String(error));
    }
  };

  const resolvePreviewGuardStateForClient = async (
    nodeType: string,
    nodeId: NodeId
  ): Promise<{ canOpen: boolean; finalStepIndex?: number }> =>
    resolvePreviewGuardState({ client, nodeType, nodeId });

  return { openEditDialog, resolvePreviewGuardState: resolvePreviewGuardStateForClient };
};
