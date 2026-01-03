/**
 * Mutation actions for TreeConsole.
 */

import type { NodeId, NodeType, TreeId } from '@hierarchidb/common-types';
import type { TreeConsoleActionDeps, MaybeCP } from '../types.js';
import {
  createUniqueName,
  fireCmdEvent,
  resolveTrashNavigationTarget,
  showCommandError,
} from './helpers.ts';
import type { NavigationHelpers } from './navigation.ts';

export const createMutationActions = (
  deps: TreeConsoleActionDeps,
  navigation: NavigationHelpers
) => {
  const {
    client,
    treeId,
    pageNodeId,
    pageTreeNode,
    selectedIds,
    loadChildrenOf,
    refreshUndoRedo,
    setSSOT,
    setState,
    setupSubscription,
    teardownSubscription,
  } = deps;

  const moveSelectionToTrash = async () => {
    if (!client || selectedIds.length === 0) return;
    const ok = confirm(`Move ${selectedIds.length} item(s) to trash?`);
    if (!ok) return;

    let navigationParentId: NodeId | null | undefined;
    if (pageNodeId) {
      navigationParentId = await resolveTrashNavigationTarget({
        client,
        pageNodeId: pageNodeId as NodeId,
        pageTreeNode,
        selectedIds,
      });
      if (typeof navigationParentId !== 'undefined') {
        navigation.pushToNode(navigationParentId);
      }
    }

    try {
      if (pageNodeId) {
        await teardownSubscription(pageNodeId as NodeId);
      }
      const mutationAPI = await client.getMutationAPI();
      const res = await mutationAPI.moveNodesToTrash(selectedIds as NodeId[]);
      if (!res.success) {
        showCommandError('INVALID_OPERATION', res.error || 'Remove failed');
        return;
      }
      const refreshTarget =
        typeof navigationParentId !== 'undefined' && navigationParentId
          ? (navigationParentId as NodeId)
          : (pageNodeId as NodeId);
      await loadChildrenOf(refreshTarget);
      setSSOT({ selectedIds: [] });
      fireCmdEvent();
      await setupSubscription(refreshTarget);
    } catch (error) {
      console.error('Trash failed:', error);
      showCommandError('UNKNOWN_ERROR');
    }
  };

  const handleCreate = async () => {
    if (!client || !pageNodeId || !treeId) return;
    try {
      const nodeType: NodeType = 'folder' as NodeType;
      const mutationAPI = await client.getMutationAPI();
      const queryAPI = await client.getQueryAPI();
      const siblings = await queryAPI.listChildren(pageNodeId as NodeId);
      const siblingNames = siblings
        .map((n) => (typeof n?.metadata?.name === 'string' ? n.metadata.name : ''))
        .filter((n) => n);
      const baseName = 'New Folder';
      const resolvedName = createUniqueName(siblingNames, baseName);
      const res = await mutationAPI.createNode({
        nodeType,
        treeId: treeId as TreeId,
        parentId: pageNodeId as NodeId,
        name: resolvedName,
        isTemporary: true,
      });
      if (!res?.success) {
        const err = (res as unknown as { error?: string })?.error;
        showCommandError('INVALID_OPERATION', err || 'Create failed');
        return;
      }
      const wcNodeId = res.nodeId as NodeId;
      fireCmdEvent();
      if (deps.pushPath) {
        deps.pushPath(`/t/${treeId}/${pageNodeId}/${wcNodeId}/${String(nodeType)}/create`);
      }
    } catch (error) {
      console.error('Create failed:', error);
      showCommandError('UNKNOWN_ERROR');
    }
  };

  const handleDuplicate = async () => {
    if (!client || selectedIds.length === 0) return;
    try {
      const mutationAPI = await client.getMutationAPI();
      const toParentId = pageNodeId as NodeId;
      const res = await mutationAPI.duplicateNodes({
        nodeIds: selectedIds as NodeId[],
        toParentId,
      });
      if (!res.success) {
        showCommandError('INVALID_OPERATION', res.error || 'Duplicate failed');
        return;
      }
      await loadChildrenOf(toParentId);
      await refreshUndoRedo();
      fireCmdEvent();

      const getCP = (client as unknown as MaybeCP).getCommandProcessor;
      if (typeof getCP === 'function') {
        const cp = await getCP();
        const canUndo = cp && typeof cp.canUndo === 'function' ? cp.canUndo() : false;
        const canRedo = cp && typeof cp.canRedo === 'function' ? cp.canRedo() : false;
        setState((prev) => ({ ...prev, canUndo: Boolean(canUndo), canRedo: Boolean(canRedo) }));
      }
    } catch (error) {
      console.error('Duplicate failed:', error);
    }
  };

  const handleMoveNodes = async (nodeIds: string[], targetParentId: string) => {
    if (!client || nodeIds.length === 0 || !targetParentId) return;
    try {
      const mutationAPI = await client.getMutationAPI();
      const res = await mutationAPI.moveNodes({
        nodeIds: nodeIds as NodeId[],
        toParentId: targetParentId as NodeId,
      });
      if (!res.success) {
        showCommandError('INVALID_OPERATION', res.error || 'Move failed');
        return;
      }
      await loadChildrenOf(targetParentId as NodeId);
      await refreshUndoRedo();
      fireCmdEvent();
    } catch (error) {
      console.error('Move failed:', error);
      showCommandError('UNKNOWN_ERROR');
    }
  };

  return {
    moveSelectionToTrash,
    handleCreate,
    handleDuplicate,
    handleMoveNodes,
  };
};
