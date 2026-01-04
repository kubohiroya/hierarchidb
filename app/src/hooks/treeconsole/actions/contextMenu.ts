/**
 * Context menu action handler for TreeConsole.
 */

import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-types';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import { isFolderNodeType } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { notify } from '@hierarchidb/components';
import type { ContextAction, TreeConsoleActionDeps } from '../types.js';
import {
  createUniqueName,
  fireCmdEvent,
  getOrCreateIndex,
  resolvePreviewStepIndex,
  showCommandError,
} from './helpers.ts';
import type { NavigationHelpers } from './navigation.ts';
import { PREVIEW_GUARD_MESSAGE, PREVIEW_GUARD_NODE_TYPES } from './dialog.ts';
import { loadUIPlugin } from '../../../plugin-loaders/ui-plugin-loader.ts';

type OpenEditDialog = (
  targetNodeId: NodeId,
  nodeHint?: HierarchicalTreeNode | TreeNode,
  dialogOptions?: {
    initialStep?: number;
    displayMode?: 'full' | 'normal';
    action?: 'edit' | 'preview';
  }
) => Promise<void>;

type PreviewGuardResolver = (
  nodeType: string,
  nodeId: NodeId
) => Promise<{ canOpen: boolean; finalStepIndex?: number }>;

type ContextMenuHelpers = {
  applyClipboard: (ids: NodeId[], cut: boolean) => void;
  openEditDialog: OpenEditDialog;
  resolvePreviewGuardState: PreviewGuardResolver;
  navigation: NavigationHelpers;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const createContextMenuAction = (deps: TreeConsoleActionDeps, helpers: ContextMenuHelpers) => {
  const {
    client,
    treeId,
    pageNodeId,
    pushPath,
    selectedIds,
    ssot,
    setSSOT,
    loadChildrenOf,
    refreshUndoRedo,
  } = deps;
  const { applyClipboard, openEditDialog, resolvePreviewGuardState, navigation } = helpers;

  return {
    handleContextMenuAction: (
      action: string,
      node: HierarchicalTreeNode,
      options?: {
        navigateToParent?: boolean;
        expandTarget?: boolean;
        source?: 'breadcrumb' | 'treetable' | 'speedDial';
        nextVisible?: boolean;
      },
    ): void => {
      void (async () => {
        const normalizedAction = (action === 'remove' ? 'trash' : action) as ContextAction;
        console.log('Context menu action:', normalizedAction, 'for node:', node);

        const targetNodeId = node.id as NodeId;
        const parentId = (node.parentId as NodeId | undefined) ?? (pageNodeId as NodeId | undefined);

        const refreshParent = async (id: NodeId | undefined) => {
          if (!id) return;
          await loadChildrenOf(id);
        };

        if (normalizedAction === 'edit') {
          setSSOT({ selectedIds: [targetNodeId] });
          await openEditDialog(targetNodeId, node);
          return;
        }

        if (normalizedAction.startsWith('create:')) {
          if (!client || !treeId) return;
          const source = options?.source ?? 'speedDial';
          const newType = normalizedAction.replace('create:', '') as NodeType;
          try {
            const mutationAPI = await client.getMutationAPI();
            const queryAPI = await client.getQueryAPI();
            const siblings = await queryAPI.listChildren(targetNodeId);
            const siblingNames = siblings
              .map((n) => (typeof n?.metadata?.name === 'string' ? n.metadata.name : ''))
              .filter((n) => n);
            const displayName = newType.charAt(0).toUpperCase() + newType.slice(1);
            const baseName = `New ${displayName}`;
            const resolvedName = createUniqueName(siblingNames, baseName);
            const res = await mutationAPI.createNode({
              nodeType: newType,
              treeId: treeId as TreeId,
              parentId: targetNodeId,
              name: resolvedName,
              isTemporary: true,
            });
            if (!res?.success) {
              const err = (res as unknown as { error?: string })?.error;
              showCommandError('INVALID_OPERATION', err || 'Create failed');
              return;
            }
            const wcNodeId = res.nodeId as NodeId;

            const navigateToCreateDialog = () => {
              if (!pushPath) return;
              const nodeTypePath = String(newType);
              pushPath(`/t/${treeId}/${targetNodeId}/${wcNodeId}/${nodeTypePath}/create`);
            };

            if (source === 'breadcrumb') {
              await refreshParent(targetNodeId);
              if (pushPath) {
                navigation.navigateTo(targetNodeId);
              }
              return;
            }

            if (source === 'treetable') {
              const expanded = new Set<NodeId>((ssot.expandedIds as NodeId[]) ?? []);
              if (!expanded.has(targetNodeId)) {
                expanded.add(targetNodeId);
                setSSOT({ expandedIds: Array.from(expanded) });
              }
              const selected = new Set<NodeId>((ssot.selectedIds as NodeId[]) ?? []);
              selected.clear();
              selected.add(wcNodeId);
              setSSOT({ selectedIds: Array.from(selected) });

              setTimeout(() => {
                void refreshParent(targetNodeId);
              }, 0);
              await refreshUndoRedo();
              navigateToCreateDialog();
              return;
            }

            // default (speed dial etc.)
            await refreshParent(targetNodeId);
            navigateToCreateDialog();
          } catch {
            // ...existing code...
          }
        }

        if (normalizedAction === 'preview') {
          const resolvedNodeType = String(node?.nodeType ?? (node as { type?: string })?.type ?? '');
          const normalizedNodeType = resolvedNodeType.toLowerCase();
          if (isFolderNodeType(resolvedNodeType) || normalizedNodeType === 'folder') {
            const mapZxy = (() => {
              if (!isRecord((node as { map?: unknown }).map)) return undefined;
              const zxy = (node as { map?: { zxy?: unknown } }).map?.zxy;
              return typeof zxy === 'string' ? zxy : undefined;
            })();
            if (pushPath) {
              const search = mapZxy ? `?zxy=${encodeURIComponent(mapZxy)}` : '';
              pushPath(`/map/${targetNodeId}${search}`);
            }
            return;
          }
          if (normalizedNodeType) {
            await loadUIPlugin(normalizedNodeType).catch(() => false);
          }
          let previewStepIndex = resolvePreviewStepIndex({
            nodeType: resolvedNodeType,
            nodeId: targetNodeId,
          });
          const shouldGuardPreview = PREVIEW_GUARD_NODE_TYPES.has(normalizedNodeType);

          if (shouldGuardPreview) {
            const guard = await resolvePreviewGuardState(resolvedNodeType, targetNodeId);
            if (!guard.canOpen) {
              notify.error(PREVIEW_GUARD_MESSAGE);
              return;
            }
            if (typeof guard.finalStepIndex === 'number') {
              previewStepIndex = guard.finalStepIndex;
            }
          }

          await openEditDialog(targetNodeId, node, {
            initialStep: previewStepIndex ?? undefined,
            displayMode: shouldGuardPreview || previewStepIndex != null ? 'full' : undefined,
            action: 'preview',
          });
          return;
        }

        if (normalizedAction === 'rename-inline' && node?.id && typeof node.metadata?.name === 'string') {
          try {
            const mutationAPI = await client?.getMutationAPI();
            const next = node.metadata.name.trim();
            const current = ssot.nodeIndex?.get(node.id as NodeId)?.metadata?.name ?? '';
            if (next === current) return;
            if (!next) {
              showCommandError('VALIDATION_ERROR', 'Name is required');
              return;
            }
            if (next.length > 255) {
              showCommandError('VALIDATION_ERROR', 'Name is too long (max 255)');
              return;
            }
            if (!/^[^<>:"/\\|?*]+$/.test(next)) {
              showCommandError('VALIDATION_ERROR', 'Invalid characters in name');
              return;
            }
            const res = await mutationAPI?.updateNode({ nodeId: node.id as NodeId, name: next });
            if (!res || !res.success) {
              showCommandError('INVALID_OPERATION', res?.error || 'Update failed');
              return;
            }
            await refreshParent(parentId ?? (pageNodeId as NodeId));
            await refreshUndoRedo();
            fireCmdEvent();
          } catch (error) {
            console.error('Inline rename failed:', error);
            showCommandError('UNKNOWN_ERROR');
          }
          return;
        }

        if (
          normalizedAction === 'update-desc-inline' &&
          node?.id &&
          typeof node.metadata?.description === 'string'
        ) {
          try {
            const mutationAPI = await client?.getMutationAPI();
            const next = String(node.metadata?.description ?? '').trim();
            const current = ssot.nodeIndex?.get(node.id as NodeId)?.metadata?.description ?? '';
            if (next === current) return;
            if (next.length > 1000) {
              showCommandError('VALIDATION_ERROR', 'Description is too long (max 1000)');
              return;
            }
            const res = await mutationAPI?.updateNode({
              nodeId: node.id as NodeId,
              description: next,
            });
            if (!res || !res.success) {
              showCommandError('INVALID_OPERATION', res?.error || 'Update failed');
              return;
            }
            await refreshParent(parentId ?? (pageNodeId as NodeId));
            await refreshUndoRedo();
            fireCmdEvent();
          } catch (error) {
            console.error('Inline description update failed:', error);
            showCommandError('UNKNOWN_ERROR');
          }
          return;
        }

        if (normalizedAction === 'toggle-visibility' && node?.id) {
          if (!client) return;
          try {
            const mutationAPI = await client.getMutationAPI();
            const nextVisible =
              typeof options?.nextVisible === 'boolean'
                ? options.nextVisible
                : !((node as { visible?: boolean }).visible !== false);
            const res = await mutationAPI.updateNode({
              nodeId: targetNodeId,
              visible: nextVisible,
            });
            if (!res.success) {
              showCommandError('INVALID_OPERATION', res.error || 'Update failed');
              return;
            }
            const index = getOrCreateIndex(ssot);
            const existing = index.get(targetNodeId) ?? (node as TreeNode | undefined);
            if (existing) {
              const parentKey = (existing.parentId ?? parentId ?? '') as NodeId;
              index.set(targetNodeId, { ...existing, visible: nextVisible }, parentKey);
              setSSOT({ nodeIndex: index });
            }
            await refreshParent(parentId ?? (pageNodeId as NodeId));
            await refreshUndoRedo();
            fireCmdEvent();
          } catch (error) {
            console.error('Toggle visibility failed:', error);
            showCommandError('UNKNOWN_ERROR');
          }
          return;
        }

        if (normalizedAction === 'copy') {
          applyClipboard([targetNodeId], false);
          return;
        }

        if (normalizedAction === 'cut') {
          applyClipboard([targetNodeId], true);
          if (options?.navigateToParent) {
            navigation.navigateTo(parentId ?? null);
          }
          return;
        }

        if (normalizedAction === 'duplicate') {
          if (!client) return;
          try {
            const mutationAPI = await client.getMutationAPI();
            const toParentId = parentId ?? pageNodeId;
            const res = await mutationAPI.duplicateNodes({
              nodeIds: [targetNodeId],
              toParentId: toParentId as NodeId,
            });
            if (!res.success) {
              showCommandError('INVALID_OPERATION', res.error || 'Duplicate failed');
              return;
            }
            await refreshParent(toParentId as NodeId);
            await refreshUndoRedo();
            fireCmdEvent();
          } catch (error) {
            console.error('Duplicate failed:', error);
            showCommandError('UNKNOWN_ERROR');
          }
          return;
        }

        if (normalizedAction === 'trash') {
          if (!client) return;
          try {
            const scopeParent = parentId ?? pageNodeId;
            if (selectedIds.length === 0) {
              showCommandError('INVALID_OPERATION', 'No items selected');
              return;
            }
            const mutationAPI = await client.getMutationAPI();
            const res = await mutationAPI.moveNodesToTrash(selectedIds);
            if (!res.success) {
              showCommandError('INVALID_OPERATION', res.error || 'Delete failed');
              return;
            }
            await refreshParent(scopeParent as NodeId);
            await refreshUndoRedo();
            fireCmdEvent();
          } catch (error) {
            console.error('Delete failed:', error);
            showCommandError('UNKNOWN_ERROR');
          }
          return;
        }

        showCommandError('INVALID_OPERATION', `Unknown action: ${action}`);
      })();
    },
  };
};

