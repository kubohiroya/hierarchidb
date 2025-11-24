import type { CommitDraftOptions, DraftAPI } from '@hierarchidb/common-api';
import type {
  CommitResult,
  NodeId,
  NodeType,
  OnNameConflict,
  TreeId,
  TreeNode,
  ValidationResult,
} from '@hierarchidb/common-types';
import { resolveDefaultNodeName } from '../utils/default-node-name.js';
import type { CommandProcessor } from './CommandProcessor.js';
import type { CoreDB } from './CoreDB.js';
import {
  initTreeNode,
  discardDraft as discardWc,
  touchDraftNode as touchDraft,
  updateTreeNodeDraftMetadata,
  updateTreeNodeDraftData,
  commitDraft as commitDraftOp,
  getTreeNode,
} from './DraftTreeNodeOperations.js';
import { syncPeerDataFromNode } from './peerDataRegistry.js';

/**
 * DraftService - minimal implementation backed by EphemeralDB/CoreDB
 *
 * Note: This service returns only serializable data. It does not expose ProxyMarked types.
 */
export class DraftService implements DraftAPI {
  constructor(
    private coreDB: CoreDB,
    _ephemeralDB: unknown,
    _commandProcessor?: CommandProcessor
  ) {}

  async createDraftBase(
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
      (initialData as { id?: NodeId } | undefined)?.id
    );
    const wc = await this.coreDB.nodes.get(wcNodeId);
    if (!wc) throw new Error('Working copy creation failed');
    return wc as TreeNode;
  }

  async createDraftFromNode(nodeId: NodeId): Promise<TreeNode> {
    const node = await this.coreDB.nodes.get(nodeId);
    if (!node) throw new Error('Working copy not created');
    await touchDraft(this.coreDB, node as TreeNode);
    return node as TreeNode;
  }

  async getDraft(nodeId: NodeId): Promise<TreeNode | undefined> {
    const wc = await getTreeNode(this.coreDB, nodeId);
    if (wc) {
      await touchDraft(this.coreDB, wc as TreeNode);
    }
    return wc ?? undefined;
  }

  async updateDraft(nodeId: NodeId, updates: Partial<TreeNode>): Promise<TreeNode> {
    if (updates.metadata || updates.draftMetadata) {
      await updateTreeNodeDraftMetadata(
        this.coreDB,
        nodeId,
        (updates.draftMetadata ?? updates.metadata) as any
      );
    }
    if (updates.data || updates.draftData) {
      await updateTreeNodeDraftData(
        this.coreDB,
        nodeId,
        (updates.draftData ?? updates.data ?? {}) as any
      );
    }
    const next = await this.coreDB.nodes.get(nodeId);
    if (!next) throw new Error('Working copy update failed');
    await syncPeerDataFromNode(next as TreeNode);
    return next as TreeNode;
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
    const result = await commitDraftOp(this.coreDB, draftId, conflictPolicy);
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

  async discardDraft(nodeId: NodeId): Promise<void> {
    const wc = await getTreeNode(this.coreDB, nodeId);
    if (!wc) return;
    await discardWc(this.coreDB, nodeId);
  }

  async discardAllDrafts(): Promise<number> {
    const list = await this.listDrafts();
    for (const wc of list) await discardWc(this.coreDB, wc.id as NodeId);
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
    for (const wc of toDelete) await discardWc(this.coreDB, wc.id as NodeId);
    return toDelete.length;
  }
}
