/**
 * Mutation actions for TreeConsole.
 */

import { notify } from '@hierarchidb/components';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { MaybeCP, TreeConsoleActionDeps } from '~/hooks/treeconsole/types';
import type { NavigationHelpers } from './navigation.ts';
import {
  confirmOverwrite,
  createUniqueName,
  fireCmdEvent,
  isNameConflictError,
  resolveArchiveNavigationTarget,
  showCommandError,
} from './treeConsoleActionUtils.ts';

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
    translateWithFallback,
  } = deps;

  const translateError = (key: string, fallback: string): string =>
    translateWithFallback ? translateWithFallback(key, fallback) : fallback;
  const resolveArchiveErrorMessage = (error?: string): string => {
    if (!error)
      return translateError('treeConsole.errors.archiveFailed', 'Move to archive failed.');
    if (error === 'TRASH_REF_ROUTE') {
      return translateError(
        'treeConsole.errors.archiveReferencedByRoutes',
        'Cannot move to archive because routes reference this location.'
      );
    }
    if (error === 'TRASH_REF_LOCATION') {
      return translateError(
        'treeConsole.errors.archiveReferencedByLocations',
        'Cannot move to archive because locations reference this shape.'
      );
    }
    if (error === 'TRASH_BUILD_SESSION_RUNNING') {
      return translateError(
        'treeConsole.errors.archiveBuildSessionRunning',
        'Cannot move to archive while the build session is running.'
      );
    }
    return error;
  };

  const moveSelectionToArchive = async () => {
    if (!client || selectedIds.length === 0) return;
    const ok = confirm(`Move ${selectedIds.length} item(s) to archive?`);
    if (!ok) return;

    let navigationParentId: NodeId | null | undefined;
    if (pageNodeId) {
      navigationParentId = await resolveArchiveNavigationTarget({
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
      const res = await mutationAPI.moveNodesToArchive(selectedIds as NodeId[]);
      if (!res.success) {
        const message = resolveArchiveErrorMessage(res.error);
        notify.error(message);
        showCommandError('INVALID_OPERATION', message);
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
      console.error('Archive failed:', error);
      showCommandError('UNKNOWN_ERROR');
    }
  };

  const handleCreate = async () => {
    if (!client || !pageNodeId || !treeId) return;
    try {
      const nodeType: NodeType = 'folder' as NodeType;
      const mutationAPI = await client.getMutationAPI();
      const queryAPI = await client.getQueryAPI();
      const siblings = (await queryAPI.listChildren(pageNodeId as NodeId)) as TreeNode[];
      const siblingNames = siblings
        .map((node) => (typeof node?.metadata?.name === 'string' ? node.metadata.name : ''))
        .filter((name): name is string => Boolean(name));
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
        const err = (res as { error?: string })?.error;
        showCommandError('INVALID_OPERATION', err || 'Create failed');
        return;
      }
      const wcNodeId = res.nodeId as NodeId;
      fireCmdEvent();
      if (deps.pushPath) {
        deps.pushPath(`/d/${treeId}/${pageNodeId}/${wcNodeId}/${String(nodeType)}/create`);
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

      const getCP = (client as MaybeCP).getCommandProcessor;
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
        onNameConflict: 'error',
      });
      if (!res.success) {
        if (isNameConflictError(res.error)) {
          const message = translateError(
            'treeConsole.conflicts.moveOverwrite',
            'A node with the same name exists. Overwrite it?'
          );
          const allowOverwrite = confirmOverwrite(message);
          if (!allowOverwrite) {
            return;
          }
          const overwriteResult = await mutationAPI.moveNodes({
            nodeIds: nodeIds as NodeId[],
            toParentId: targetParentId as NodeId,
            onNameConflict: 'overwrite',
          });
          if (!overwriteResult.success) {
            showCommandError('INVALID_OPERATION', overwriteResult.error || 'Move failed');
            return;
          }
        } else {
          showCommandError('INVALID_OPERATION', res.error || 'Move failed');
          return;
        }
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
    moveSelectionToArchive,
    handleCreate,
    handleDuplicate,
    handleMoveNodes,
  };
};
