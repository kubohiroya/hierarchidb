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
  createDraftBase,
  createDraftFromNode as createWcFromNode,
  discardDraft as discardWc,
  getDraft as getWc,
  touchDraftNode as touchDraft,
  updateDraft as updateWc,
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
    const wcNodeId = await createDraftBase(
      this.coreDB,
      treeId,
      parentId,
      nodeType,
      desiredName,
      (initialData as { id?: NodeId } | undefined)?.id
    );
    const wc = await this.coreDB.nodes.get(wcNodeId);
    if (!wc) throw new Error('Working copy creation failed');
    return wc;
  }

  async createDraftFromNode(nodeId: NodeId): Promise<TreeNode> {
    const treeId = nodeId.split(':')[0] as TreeId;
    await createWcFromNode(this.coreDB, treeId, nodeId);
    const wc = await getWc(this.coreDB, nodeId);
    if (!wc) throw new Error('Working copy not created');
    return wc;
  }

  async getDraft(nodeId: NodeId): Promise<TreeNode | undefined> {
    const wc = await getWc(this.coreDB, nodeId);
    if (wc) {
      await touchDraft(this.coreDB, wc as TreeNode);
    }
    return wc ?? undefined;
  }

  async updateDraft(nodeId: NodeId, updates: Partial<TreeNode>): Promise<TreeNode> {
    const current = await getWc(this.coreDB, nodeId);
    if (!current) throw new Error(`Working copy for ${nodeId} not found`);
    await updateWc(this.coreDB, nodeId, { ...updates });
    const next = await this.coreDB.nodes.get(nodeId);
    if (!next) throw new Error('Working copy update failed');
    await syncPeerDataFromNode(next as TreeNode);
    return next;
  }

  async listDrafts(): Promise<TreeNode[]> {
    // Drafts are nodes with draftData present
    const allNodes = await this.coreDB.nodes.toArray();
    return allNodes.filter((node) => node.draftData !== null && node.draftData !== undefined);
  }

  async hasDraft(nodeId: NodeId): Promise<boolean> {
    const wc = await getWc(this.coreDB, nodeId);
    return !!wc;
  }

  async commitDraft(
    draftId: NodeId,
    options?: CommitDraftOptions
  ): Promise<CommitResult> {
    const conflictPolicy: OnNameConflict = options?.onNameConflict ?? 'auto-rename';
    const { commitDraft } = await import('./DraftTreeNodeOperations.js');
    const result = await commitDraft(this.coreDB, draftId, conflictPolicy);
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
    const wc = await getWc(this.coreDB, nodeId);
    if (!wc) return;
    await discardWc(this.coreDB, nodeId);
  }

  async discardAllDrafts(): Promise<number> {
    const list = await this.listDrafts();
    for (const wc of list) await discardWc(this.coreDB, wc.id as NodeId);
    return list.length;
  }

  async validateDraft(nodeId: NodeId): Promise<ValidationResult> {
    const exists = await getWc(this.coreDB, nodeId);
    return exists ? { valid: true } : { valid: false, message: 'Working copy not found' };
  }

  async hasUnsavedChanges(nodeId: NodeId): Promise<boolean> {
    return !!(await getWc(this.coreDB, nodeId));
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
