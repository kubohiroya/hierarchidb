import type {
  CommitDraftRequest,
  CommitDraftMode,
  DiscardDraftOptions,
  TreeNodeUpdaterAPI,
} from '@hierarchidb/common-api';
import type {
  CommitResult,
  NodeId,
  NodeType,
  OnNameConflict,
  TreeId,
  TreeNode,
  TreeNodeMetadata,
  ValidationResult,
  DialogUIState,
  TreeNodeData,
} from '@hierarchidb/common-types';
import { resolveDefaultNodeName } from '../utils/default-node-name.js';
import type { CommandProcessor } from './CommandProcessor.js';
import type { CoreDB } from './CoreDB.js';
import {
  initTreeNode,
  discardDraft as discardWc,
  updateTreeNodeDraftMetadata,
  updateTreeNodeDraftData,
  commitDraft as commitDraftOp,
  getTreeNode,
} from './DraftTreeNodeOperations.js';

/**
 * DraftService - minimal implementation backed by CoreDB TreeNodes.
 * Note: This service returns only serializable data. It does not expose ProxyMarked types.
 */
export class TreeNodeUpdaterService implements TreeNodeUpdaterAPI {
  constructor(
    private coreDB: CoreDB,
    _commandProcessor?: CommandProcessor
  ) {}

  private readonly defaultDialogUIState: DialogUIState = {
    dialogWindow: {
      mode: 'normal',
      position: { x: 0, y: 0 },
      size: { width: 960, height: 640 },
    },
    dialogProgress: {
      activeStepIndex: 0,
    },
  };

  /**
   * Returns a copy of the node normalized for TreeNodeUpdaterAPI consumers:
   * - draftMetadata: never null (falls back to metadata/default)
   * - draftData: never null (uses draftData, else data clone, else empty object)
   * - dialogUIState: never null (uses stored or default)
   *
   * Does NOT persist changes; QueryAPI/SubscriptionAPI are untouched.
   */
  private normalizeForUpdater(node?: TreeNode, fallbackName?: string): TreeNode | undefined {
    if (!node) return undefined;
    type EmptyTreeNodeData = TreeNodeData;
    const emptyDraftDataByType: Record<string, EmptyTreeNodeData> = {
      folder: {},
    };
    const metadata = (node as { metadata?: TreeNodeMetadata | null }).metadata ?? {
      name: fallbackName ?? resolveDefaultNodeName(node.nodeType as NodeType),
      description: '',
      tags: [],
    };
    const draftMetadata =
      (node as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata ?? { ...metadata };
    const dataVal = (node as { data?: unknown }).data;
    const draftDataVal = (node as { draftData?: unknown }).draftData;
    let draftData: Record<string, unknown>;
    if (draftDataVal && typeof draftDataVal === 'object') {
      draftData = { ...(draftDataVal as Record<string, unknown>) };
    } else if (dataVal && typeof dataVal === 'object') {
      draftData = { ...(dataVal as Record<string, unknown>) };
    } else if (node.nodeType in emptyDraftDataByType) {
      draftData = { ...emptyDraftDataByType[node.nodeType] };
    } else {
      throw new Error(
        `[TreeNodeUpdaterService] draftData/data missing for node ${String(node.id ?? node.nodeType)}`
      );
    }
    const dialogUIState =
      (node as { dialogUIState?: DialogUIState | null }).dialogUIState ?? this.defaultDialogUIState;

    return {
      ...(node as TreeNode),
      draftMetadata,
      draftData,
      dialogUIState,
    };
  }

  private async ensureDraftMetadata(
    node?: TreeNode,
    fallbackName?: string,
    persist: boolean = false
  ): Promise<TreeNode | undefined> {
    if (!node) return undefined;
    const draftMeta = (node as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata ?? null;
    if (draftMeta !== null) {
      return node;
    }
    const base =
      (node as { metadata?: TreeNodeMetadata | null }).metadata ??
      {
        name: fallbackName ?? resolveDefaultNodeName(node.nodeType as NodeType),
        description: '',
        tags: [],
      };
    if (persist) {
      await this.coreDB.nodes.update(node.id as NodeId, {
        draftMetadata: base,
      });
      const refreshed = await this.coreDB.nodes.get(node.id);
      return refreshed as TreeNode | undefined;
    }
    return {
      ...node,
      draftMetadata: base,
    } as TreeNode;
  }

  private async ensureDialogUIState(node?: TreeNode, persist: boolean = false): Promise<TreeNode | undefined> {
    if (!node) return undefined;
    const current = (node as { dialogUIState?: DialogUIState | null }).dialogUIState ?? null;
    if (current && current.dialogWindow && current.dialogProgress) {
      return node;
    }
    const fallback: DialogUIState = {
      dialogWindow: {
        mode: 'normal',
        position: { x: 0, y: 0 },
        size: { width: 960, height: 640 },
      },
      dialogProgress: {
        activeStepIndex: 0,
      },
    };
    if (persist) {
      await this.coreDB.nodes.update(node.id as NodeId, { dialogUIState: current ?? fallback });
      const refreshed = await this.coreDB.nodes.get(node.id);
      return refreshed as TreeNode | undefined;
    }
    return {
      ...node,
      dialogUIState: current ?? fallback,
    } as TreeNode;
  }

  async initTreeNode(
    nodeType: NodeType,
    parentId: NodeId,
    initialData?: Partial<TreeNode>
  ): Promise<TreeNode> {
    const treeId = parentId.split(':')[0] as TreeId;
    const desiredName =
      (initialData as { metadata?: { name?: string } } | undefined)?.metadata?.name?.trim() ||
      resolveDefaultNodeName(nodeType);
    const wcNodeId = await initTreeNode(
      this.coreDB,
      treeId,
      parentId,
      nodeType,
      desiredName,
      (initialData as { id?: NodeId } | undefined)?.id,
      initialData
    );
    const wc = await this.coreDB.nodes.get(wcNodeId);
    if (!wc) throw new Error('Working copy creation failed');
    // Ensure draftMetadata is always present; for edit mode seed from metadata when absent.
    const hasDraftMeta =
      (wc as { draftMetadata?: unknown }).draftMetadata !== null &&
      typeof (wc as { draftMetadata?: unknown }).draftMetadata !== 'undefined';
    if (!hasDraftMeta) {
      await this.coreDB.nodes.update(wcNodeId, {
        draftMetadata: {
          ...((wc as { metadata?: TreeNode['metadata'] }).metadata ?? {
            name: desiredName,
            description: '',
            tags: [],
          }),
          ...(initialData?.draftMetadata ?? initialData?.metadata ?? {}),
        },
      });
      const refreshed = (await this.coreDB.nodes.get(wcNodeId)) ?? undefined;
      const withMeta = await this.ensureDraftMetadata(refreshed, desiredName, true);
      const withUi = await this.ensureDialogUIState(withMeta ?? refreshed, true);
      return (withUi ?? withMeta ?? refreshed)!;
    }
    const withMeta = await this.ensureDraftMetadata(wc ?? undefined, desiredName, true);
    const withUi = await this.ensureDialogUIState(withMeta ?? wc ?? undefined, true);
    return (withUi ?? withMeta ?? wc)!;
  }

  async getTreeNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    const node = await this.coreDB.nodes.get(nodeId);
    if (!node) return undefined;
    const withMeta = await this.ensureDraftMetadata(node ?? undefined, undefined, false);
    const withUi = await this.ensureDialogUIState(withMeta ?? node ?? undefined, false);
    return this.normalizeForUpdater((withUi ?? withMeta ?? node) ?? undefined);
  }

  // createDraftFromNode / getDraft / updateDraft are removed in favor of QueryAPI + updater calls.

  async updateTreeNodeDraftMetadata(
    nodeId: NodeId,
    updater: Partial<TreeNodeMetadata> | null
  ): Promise<void> {
    await updateTreeNodeDraftMetadata(this.coreDB, nodeId, updater);
  }

  async updateTreeNodeDraftData(
    nodeId: NodeId,
    updater: Record<string, unknown> | null
  ): Promise<void> {
    await updateTreeNodeDraftData(this.coreDB, nodeId, updater);
  }

  async listDrafts(): Promise<TreeNode[]> {
    // Drafts are nodes with draftData present
    const allNodes = await this.coreDB.nodes.toArray();
    return allNodes.filter((node) => node.draftData !== null && node.draftData !== undefined);
  }

  async hasDraft(nodeId: NodeId): Promise<boolean> {
    const wc = await getTreeNode(this.coreDB, nodeId);
    return !!wc;
  }

  async updateTreeNode(
    draftId: NodeId,
    request?: CommitDraftRequest
  ): Promise<CommitResult> {
    const conflictPolicy: OnNameConflict = request?.onNameConflict ?? 'auto-rename';
    const mode: CommitDraftMode = request?.mode ?? 'save';

    const updates: Partial<TreeNode> = {};
    if ('draftMetadata' in (request ?? {})) {
      updates.draftMetadata = (request?.draftMetadata ?? null) as TreeNodeMetadata | null;
    }
    if ('draftData' in (request ?? {})) {
      updates.draftData = request?.draftData ?? null;
    }
    if ('dialogUIState' in (request ?? {})) {
      updates.dialogUIState = request?.dialogUIState ?? undefined;
    }
    if ('data' in (request ?? {})) {
      updates.data = request?.data ?? null;
    }
    if ('metadata' in (request ?? {})) {
      updates.metadata = (request?.metadata ?? undefined) as TreeNodeMetadata | undefined;
    }
    if (Object.keys(updates).length > 0) {
      await this.coreDB.nodes.update(draftId, updates);
    }
    // Ensure dialogUIState is persisted when provided (save-draft path often depends on it).
    if (request?.dialogUIState) {
      await this.coreDB.nodes.update(draftId, { dialogUIState: request.dialogUIState });
    }

    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[DraftService] commitDraft request', {
        draftId,
        conflictPolicy,
        mode,
      });
    }

    if (mode === 'save-draft') {
      let nodeMaybe: TreeNode | undefined = (await getTreeNode(this.coreDB, draftId)) ?? undefined;
      nodeMaybe =
        (await this.ensureDraftMetadata(nodeMaybe ?? undefined, (request?.draftMetadata as any)?.name, false)) ??
        nodeMaybe ??
        undefined;
      nodeMaybe = (await this.ensureDialogUIState(nodeMaybe ?? undefined, false)) ?? nodeMaybe ?? undefined;
      const node = this.normalizeForUpdater(nodeMaybe ?? undefined, (request?.draftMetadata as any)?.name);
      if (typeof console !== 'undefined' && typeof console.debug === 'function') {
        console.debug('[DraftService] commitDraft save-draft result', {
          nodeId: draftId,
          persistedNode: node
            ? {
                id: node.id,
                metadata: node.metadata,
                data: node.data,
                draftMetadata: (node as any).draftMetadata,
                draftData: (node as any).draftData,
                dialogUIState: (node as any).dialogUIState,
              }
            : null,
        });
      }
      return { status: 'ok', nodeId: draftId, node: node as TreeNode | undefined };
    }

    const result = await commitDraftOp(this.coreDB, draftId, conflictPolicy);
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      let nodeMaybe: TreeNode | undefined =
        result.status === 'ok' ? (await getTreeNode(this.coreDB, result.nodeId as NodeId)) ?? undefined : undefined;
      nodeMaybe =
        (await this.ensureDraftMetadata(nodeMaybe ?? undefined, (request?.draftMetadata as any)?.name, false)) ??
        nodeMaybe ??
        undefined;
      nodeMaybe = (await this.ensureDialogUIState(nodeMaybe ?? undefined, false)) ?? nodeMaybe ?? undefined;
      const node = this.normalizeForUpdater(nodeMaybe ?? undefined, (request?.draftMetadata as any)?.name);
      console.debug('[DraftService] commitDraft result', {
        status: result.status,
        nodeId: result.status === 'ok' ? result.nodeId : undefined,
        autoRenameTo: (result as any)?.autoRenameTo,
        suggestedName: (result as any)?.suggestedName,
        originalVersion: (result as any)?.originalVersion,
        wcVersion: (result as any)?.wcVersion,
        persistedNode: node
          ? {
              id: node.id,
              metadata: node.metadata,
              data: node.data,
              draftMetadata: (node as any).draftMetadata,
              draftData: (node as any).draftData,
            }
          : null,
      });
    }
    if (result.status === 'ok') {
      const normalizedNode =
        (await this.ensureDraftMetadata(
          (result.node as TreeNode | undefined) ??
            ((await getTreeNode(this.coreDB, result.nodeId as NodeId)) as TreeNode | undefined),
          (request?.draftMetadata as any)?.name,
          false
        )) ?? (result.node as TreeNode | undefined);
      const withUi = (await this.ensureDialogUIState(normalizedNode ?? undefined, false)) ?? normalizedNode;
      const forUpdater = this.normalizeForUpdater(withUi ?? undefined, (request?.draftMetadata as any)?.name);
      return { status: 'ok', nodeId: result.nodeId, autoRenameTo: result.autoRenameTo, node: forUpdater ?? undefined };
    }
    if (result.status === 'NAME_CONFLICT') {
      return {
        status: 'NAME_CONFLICT',
        suggestedName: result.suggestedName,
      };
    }
    return {
      status: 'COMMIT_CONFLICT',
      originalVersion: result.originalVersion,
      wcVersion: result.wcVersion,
    };
  }

  /** @deprecated use updateTreeNode */
  async commitDraft(draftId: NodeId, request?: CommitDraftRequest): Promise<CommitResult> {
    return this.updateTreeNode(draftId, request);
  }

  async discardDraft(nodeId: NodeId, options?: DiscardDraftOptions): Promise<void> {
    const wc = await getTreeNode(this.coreDB, nodeId);
    if (!wc) return;
    await discardWc(this.coreDB, nodeId, options);
  }

  async discardAllDrafts(): Promise<number> {
    const list = await this.listDrafts();
    for (const wc of list) await discardWc(this.coreDB, wc.id as NodeId, { forceDelete: true });
    return list.length;
  }

  async validateDraft(nodeId: NodeId): Promise<ValidationResult> {
    const exists = await getTreeNode(this.coreDB, nodeId);
    return exists ? { valid: true } : { valid: false, message: 'Working copy not found' };
  }

  async hasUnsavedChanges(nodeId: NodeId): Promise<boolean> {
    return !!(await getTreeNode(this.coreDB, nodeId));
  }

  async getDraftStats(): Promise<{
    total: number;
    drafts: number;
    edits: number;
    oldestTimestamp: number;
    newestTimestamp: number;
  }> {
    const list = await this.listDrafts();
    const now = Date.now();
    return {
      total: list.length,
      drafts: list.length,
      edits: list.length,
      oldestTimestamp: list.reduce((min, x) => Math.min(min, x.updatedAt), now),
      newestTimestamp: list.reduce((max, x) => Math.max(max, x.updatedAt), 0),
    };
  }

  async cleanupOldDrafts(olderThan: number): Promise<number> {
    const list = await this.listDrafts();
    const toDelete = list.filter((x) => x.updatedAt < olderThan);
    for (const wc of toDelete) await discardWc(this.coreDB, wc.id as NodeId, { forceDelete: true });
    return toDelete.length;
  }
}
