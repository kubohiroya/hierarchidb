import type { CommitDraftOptions, DiscardDraftOptions, TreeNodeUpdaterAPI } from '@hierarchidb/common-api';
import type {
  CommitResult,
  NodeId,
  NodeType,
  OnNameConflict,
  TreeId,
  TreeNode,
  TreeNodeMetadata,
  ValidationResult,
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
    return wc as TreeNode;
  }

  async getTreeNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    const node = await this.coreDB.nodes.get(nodeId);
    if (!node) return undefined;
    return node as TreeNode;
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

  async commitDraft(
    draftId: NodeId,
    options?: CommitDraftOptions
  ): Promise<CommitResult> {
    const conflictPolicy: OnNameConflict = options?.onNameConflict ?? 'auto-rename';
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[DraftService] commitDraft request', {
        draftId,
        conflictPolicy,
      });
    }
    const result = await commitDraftOp(this.coreDB, draftId, conflictPolicy);
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      const node = result.status === 'ok' ? await getTreeNode(this.coreDB, result.nodeId as NodeId) : null;
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
      return { status: 'ok', nodeId: result.nodeId, autoRenameTo: result.autoRenameTo };
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
