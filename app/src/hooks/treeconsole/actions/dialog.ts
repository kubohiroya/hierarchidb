/**
 * Edit/preview dialog helpers for TreeConsole.
 */

import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import { composeStepConfigs } from '@hierarchidb/plugin-base';
import { DualKeyMap } from '@hierarchidb/util';
import type { TreeConsoleActionDeps } from '../types.js';
import { showCommandError } from './helpers.ts';
import { loadUIPlugin } from '../../../plugin-loaders/ui-plugin-loader.ts';

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

export const createDialogHelpers = (deps: TreeConsoleActionDeps) => {
  const { client, treeId, pageNodeId, pageTreeNode, pushPath, ssot } = deps;

  const openEditDialog = async (
    targetNodeId: NodeId,
    nodeHint?: HierarchicalTreeNode | TreeNode,
    dialogOptions?: {
      initialStep?: number;
      displayMode?: 'full' | 'normal';
      action?: 'edit' | 'preview';
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

      const searchParams = new URLSearchParams();
      if (typeof dialogOptions?.initialStep === 'number' && dialogOptions.initialStep >= 1) {
        searchParams.set('step', String(dialogOptions.initialStep));
      }
      if (dialogOptions?.displayMode === 'full') {
        searchParams.set('mode', 'full');
      }
      const query = searchParams.toString();
      const action = dialogOptions?.action ?? 'edit';
      const basePath = `/t/${treeId}/${parentForRoute}/${canonicalId}/${nodeType}/${action}`;
      pushPath(query ? `${basePath}?${query}` : basePath);
    } catch (error) {
      console.error('Failed to launch edit dialog:', error);
      showCommandError('UNKNOWN_ERROR', error instanceof Error ? error.message : String(error));
    }
  };

  const resolvePreviewGuardState = async (
    nodeType: string,
    nodeId: NodeId
  ): Promise<{ canOpen: boolean; finalStepIndex?: number }> => {
    const normalizedNodeType = nodeType.toLowerCase();
    if (!PREVIEW_GUARD_NODE_TYPES.has(normalizedNodeType)) {
      return { canOpen: true };
    }

    await loadUIPlugin(normalizedNodeType).catch(() => false);
    let mergedData: Record<string, unknown> = {};
    let nodeSnapshot: TreeNode | undefined;
    try {
      const updaterAPI = await client.getTreeNodeUpdaterAPI();
      nodeSnapshot = await updaterAPI.getTreeNode(nodeId);
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
      : Boolean(
          String(nodeSnapshot?.draftMetadata?.name ?? nodeSnapshot?.metadata?.name ?? '').trim()
        );
    const requiredBeforeFinalValid =
      basicInfoValid &&
      configs
        .slice(0, finalConfigIndex)
        .every((cfg, idx) => cfg.optional || results[idx]);
    const finalStepValid = results[finalConfigIndex] ?? true;
    const finalStepIndex = composed.hasHostBase ? finalConfigIndex + 1 : finalConfigIndex + 2;
    return {
      canOpen: requiredBeforeFinalValid && finalStepValid,
      finalStepIndex,
    };
  };

  return { openEditDialog, resolvePreviewGuardState };
};
