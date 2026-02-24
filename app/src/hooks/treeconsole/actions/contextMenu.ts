/**
 * Context menu action handler for TreeConsole.
 */

import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { notify } from '@hierarchidb/components';
import { isFolderNodeType } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import {
  importNodeTemplateById,
  parseNodeCreateAction,
  resolveNodeCreateDefaults,
  resolveNodeTemplateExecution,
} from '~/features/templates/nodeCreateTemplates';
import { loadUIPlugin } from '~/plugin-loaders/ui-plugin-loader';
import { startBuildFlow } from '~/router/pages/tree/console/buildFlow';
import type { ContextAction, TreeConsoleActionDeps } from '~/hooks/treeconsole/types';
import { PREVIEW_GUARD_MESSAGE, PREVIEW_GUARD_NODE_TYPES } from './dialog.js';
import { openInNewTab } from '~/utils/openInNewTab';
import {
  createUniqueName,
  fireCmdEvent,
  getOrCreateIndex,
  resolvePreviewStepIndex,
  showCommandError,
} from './helpers.ts';
import type { NavigationHelpers } from './navigation.js';

type OpenEditDialog = (
  targetNodeId: NodeId,
  nodeHint?: HierarchicalTreeNode | TreeNode,
  dialogOptions?: {
    initialStep?: number;
    displayMode?: 'full' | 'normal';
    action?: 'edit' | 'preview';
    openInNewTab?: boolean;
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

export const createContextMenuAction = (
  deps: TreeConsoleActionDeps,
  helpers: ContextMenuHelpers
) => {
  const {
    client,
    treeId,
    pageNodeId,
    pushPath,
    searchTerm,
    selectedIds,
    returnTo,
    ssot,
    setSSOT,
    loadChildrenOf,
    refreshUndoRedo,
    importExport,
    translateWithFallback,
  } = deps;
  const { applyClipboard, openEditDialog, resolvePreviewGuardState, navigation } = helpers;
  const translate = (key: string, fallback: string) =>
    translateWithFallback ? translateWithFallback(key, fallback) : fallback;

  return {
    handleContextMenuAction: (
      action: string,
      node: HierarchicalTreeNode,
      options?: {
        navigateToParent?: boolean;
        expandTarget?: boolean;
        source?: 'breadcrumb' | 'treetable' | 'speedDial';
        nextVisible?: boolean;
        openInNewTab?: boolean;
      }
    ): void => {
      void (async () => {
        const normalizedAction = (action === 'remove' ? 'archive' : action) as ContextAction;

        const targetNodeId = node.id as NodeId;
        const parentId =
          (node.parentId as NodeId | undefined) ?? (pageNodeId as NodeId | undefined);

        const refreshParent = async (id: NodeId | undefined) => {
          if (!id) return;
          await loadChildrenOf(id);
        };

        if (normalizedAction.startsWith('open-step:')) {
          const rawStep = normalizedAction.split(':')[1] ?? '';
          const parsedStep = parseInt(rawStep, 10);
          if (!Number.isFinite(parsedStep) || parsedStep < 1) {
            showCommandError('INVALID_OPERATION', `Invalid step: ${rawStep}`);
            return;
          }
          setSSOT({ selectedIds: [targetNodeId] });
          await openEditDialog(targetNodeId, node, {
            initialStep: parsedStep,
            openInNewTab: options?.openInNewTab,
          });
          return;
        }

        if (normalizedAction === 'navigate') {
          if (options?.openInNewTab && treeId) {
            const qs = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : '';
            openInNewTab(`/t/${treeId}/${targetNodeId}${qs}`);
            return;
          }
          navigation.navigateTo(targetNodeId);
          return;
        }

        if (normalizedAction === 'edit') {
          setSSOT({ selectedIds: [targetNodeId] });
          await openEditDialog(targetNodeId, node, { openInNewTab: options?.openInNewTab });
          return;
        }

        if (normalizedAction.startsWith('create:')) {
          if (!client || !treeId) return;
          const source = options?.source ?? 'speedDial';
          const parsedCreate = parseNodeCreateAction(normalizedAction);
          if (!parsedCreate) {
            showCommandError('INVALID_OPERATION', `Invalid create action: ${normalizedAction}`);
            return;
          }
          const newType = parsedCreate.nodeType as NodeType;
          const selectedTemplateId = parsedCreate.shapePresetId ?? parsedCreate.templateId;
          const execution = selectedTemplateId
            ? resolveNodeTemplateExecution(parsedCreate.nodeType, selectedTemplateId)
            : null;
          if (selectedTemplateId && !execution) {
            showCommandError('INVALID_OPERATION', `Unknown template: ${selectedTemplateId}`);
            return;
          }

          const applyDraftMetadata = async (
            createdNodeId: NodeId,
            patch: {
              name?: string;
              description?: string;
              buildMetadata?: {
                buildRequired?: boolean;
              };
            }
          ) => {
            const updaterAPI = await client.getTreeNodeUpdaterAPI();
            const createdDraft = await updaterAPI.getTreeNode(createdNodeId);
            const currentMeta =
              ((createdDraft?.draftMetadata ?? {}) as {
                name?: string;
                description?: string;
                buildMetadata?: {
                  buildRequired?: boolean;
                };
              }) ?? {};
            const mergedBuildMetadata = patch.buildMetadata
              ? {
                  ...(currentMeta.buildMetadata ?? {}),
                  ...patch.buildMetadata,
                }
              : currentMeta.buildMetadata;
            await updaterAPI.updateTreeNodeDraftMetadata(createdNodeId, {
              ...currentMeta,
              ...patch,
              ...(mergedBuildMetadata ? { buildMetadata: mergedBuildMetadata } : {}),
            });
          };

          try {
            if (execution?.kind === 'importTemplate') {
              await importNodeTemplateById({
                client,
                treeId: treeId as TreeId,
                targetParentId: targetNodeId,
                templateId: execution.templateId,
              });
              await refreshParent(targetNodeId);
              await refreshUndoRedo();
              fireCmdEvent();
              return;
            }

            const mutationAPI = await client.getMutationAPI();
            const queryAPI = await client.getQueryAPI();
            const siblings = (await queryAPI.listChildren(targetNodeId)) as TreeNode[];
            const siblingNames = siblings
              .map((node) => (typeof node?.metadata?.name === 'string' ? node.metadata.name : ''))
              .filter((name): name is string => Boolean(name));
            const displayName = translate(`plugins.${newType}.name`, newType);
            const defaultBaseName = `New ${displayName}`;
            const templateDefaults = execution
              ? resolveNodeCreateDefaults(execution, translate)
              : undefined;
            const baseName = templateDefaults?.name || defaultBaseName;
            const resolvedName = createUniqueName(siblingNames, baseName);
            const res = await mutationAPI.createNode({
              nodeType: newType,
              treeId: treeId as TreeId,
              parentId: targetNodeId,
              name: resolvedName,
              description: templateDefaults?.description,
              isTemporary: true,
            });
            if (!res?.success) {
              const err = (res as { error?: string })?.error;
              showCommandError('INVALID_OPERATION', err || 'Create failed');
              return;
            }
            const wcNodeId = res.nodeId as NodeId;

            await applyDraftMetadata(wcNodeId, {
              name: resolvedName,
              description: templateDefaults?.description,
              buildMetadata: newType === 'shape' ? { buildRequired: true } : undefined,
            });

            if (templateDefaults?.draftPatch) {
              const updaterAPI = await client.getTreeNodeUpdaterAPI();
              await updaterAPI.updateTreeNodeDraftData(wcNodeId, templateDefaults.draftPatch);
            }

            const navigateToCreateDialog = () => {
              const nodeTypePath = String(newType);
              const nextUrl = `/t/${treeId}/${targetNodeId}/${wcNodeId}/${nodeTypePath}/create`;
              if (options?.openInNewTab) {
                openInNewTab(nextUrl);
                return;
              }
              if (!pushPath) return;
              pushPath(nextUrl);
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
            return;
          } catch (error) {
            console.error('Create failed:', error);
            showCommandError('UNKNOWN_ERROR');
            return;
          }
        }

        if (normalizedAction === 'import') {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,.csv';
          input.onchange = async (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const detected = importExport.detectFileFormat(file) ?? null;
            const format: 'json' | 'csv' = detected === 'csv' ? 'csv' : 'json';
            try {
              await importExport.importFile({
                file,
                targetNodeId,
                format,
                onProgress: (progress) => {
                  console.log('Import progress:', progress);
                },
              });
              await refreshParent(targetNodeId);
              await refreshUndoRedo();
              fireCmdEvent();
            } catch (error) {
              console.error('Import failed:', error);
              showCommandError('UNKNOWN_ERROR');
            }
          };
          input.click();
          return;
        }

        if (normalizedAction === 'export') {
          const resolvedNodeType = String(
            node?.nodeType ?? (node as { type?: string })?.type ?? ''
          );
          const normalizedNodeType = resolvedNodeType.toLowerCase();
          const isFolderExportAction =
            isFolderNodeType(resolvedNodeType) || normalizedNodeType === 'folder';

          if (isFolderExportAction && pushPath && treeId && pageNodeId) {
            const parentForRoute = (node.parentId as NodeId | undefined) ?? pageNodeId;
            const targetId = targetNodeId;
            pushPath(
              `/t/${treeId}/${parentForRoute}/${targetId}/folder-export/export/normal/1`
            );
            return;
          }

          if (!selectedIds.length && !targetNodeId) return;
          const exportIds =
            selectedIds.length > 0 && selectedIds.includes(targetNodeId)
              ? selectedIds
              : [targetNodeId];
          try {
            const blob = await importExport.exportNodes({
              nodeIds: exportIds,
              format: 'json',
              includeChildren: true,
              onProgress: (progress) => {
                console.log('Export progress:', progress);
              },
            });

            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `export-${Date.now()}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
          } catch (error) {
            console.error('Export failed:', error);
            showCommandError('UNKNOWN_ERROR');
          }
          return;
        }

        if (normalizedAction === 'preview') {
          const resolvedNodeType = String(
            node?.nodeType ?? (node as { type?: string })?.type ?? ''
          );
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
            openInNewTab: options?.openInNewTab,
          });
          return;
        }

        if (normalizedAction === 'build') {
          if (!client || !treeId || !pushPath || !returnTo) return;
          await startBuildFlow({
            treeId,
            pageNodeId: targetNodeId,
            node,
            returnTo,
            workerClient: client,
            navigate: (to) => {
              if (options?.openInNewTab) {
                openInNewTab(to);
                return;
              }
              pushPath(to);
            },
          });
          return;
        }

        if (
          normalizedAction === 'rename-inline' &&
          node?.id &&
          typeof node.metadata?.name === 'string'
        ) {
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

        if (normalizedAction === 'archive') {
          if (!client) return;
          try {
            const scopeParent = parentId ?? pageNodeId;
            const hasSelection = selectedIds.length > 0;
            const includesTarget = selectedIds.includes(targetNodeId);
            const resolvedIds = !hasSelection || !includesTarget ? [targetNodeId] : selectedIds;
            if (!hasSelection || !includesTarget) {
              setSSOT({ selectedIds: [targetNodeId] });
            }
            const mutationAPI = await client.getMutationAPI();
            const res = await mutationAPI.moveNodesToArchive(resolvedIds);
            if (!res.success) {
              showCommandError('INVALID_OPERATION', res.error || 'Delete failed');
              return;
            }
            await refreshParent(scopeParent as NodeId);
            await refreshUndoRedo();
            fireCmdEvent();
            if (options?.navigateToParent) {
              navigation.navigateTo(parentId ?? null);
            }
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
