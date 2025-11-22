import type { CommitWorkingCopyOptions, WorkingCopyAPI } from '@hierarchidb/common-api';
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
  createDraftWorkingCopy,
  createWorkingCopyFromNode as createWcFromNode,
  discardWorkingCopy as discardWc,
  getDraft as getWc,
  touchDraftNode as touchDraft,
  updateDraft as updateWc,
} from './WorkingCopyTreeNodeOperations.js';
import { syncPeerDataFromNode } from './peerDataRegistry.js';
import { WorkerErrorCode } from './command-types.js';

/**
 * WorkingCopyService - minimal implementation backed by EphemeralDB/CoreDB
 *
 * Note: This service returns only serializable data. It does not expose ProxyMarked types.
 */
export class WorkingCopyService implements WorkingCopyAPI {
  constructor(
    private coreDB: CoreDB,
    _ephemeralDB: unknown,
    private commandProcessor?: CommandProcessor
  ) {}

  async createDraftWorkingCopy(
    nodeType: NodeType,
    parentId: NodeId,
    initialData?: Partial<TreeNode>
  ): Promise<TreeNode> {
    const treeId = parentId.split(':')[0] as TreeId;
    const wcNodeId = await createDraftWorkingCopy(
      this.coreDB,
      treeId,
      parentId,
      nodeType,
      initialData?.name?.trim() || resolveDefaultNodeName(nodeType),
      (initialData as { id?: NodeId } | undefined)?.id
    );
    const wc = await this.coreDB.nodes.get(wcNodeId);
    if (!wc) throw new Error('Working copy creation failed');
    return wc;
  }

  async createWorkingCopyFromNode(nodeId: NodeId): Promise<TreeNode> {
    const treeId = nodeId.split(':')[0] as TreeId;
    await createWcFromNode(this.coreDB, treeId, nodeId);
    const wc = await getWc(this.coreDB, nodeId);
    if (!wc) throw new Error('Working copy not created');
    return wc;
  }

  async getWorkingCopy(nodeId: NodeId): Promise<TreeNode | undefined> {
    const wc = await getWc(this.coreDB, nodeId);
    if (wc) {
      await touchDraft(this.coreDB, wc as TreeNode);
    }
    return wc ?? undefined;
  }

  async updateWorkingCopy(nodeId: NodeId, updates: Partial<TreeNode>): Promise<TreeNode> {
    const current = await getWc(this.coreDB, nodeId);
    if (!current) throw new Error(`Working copy for ${nodeId} not found`);
    await updateWc(this.coreDB, nodeId, { ...updates });
    const next = await this.coreDB.nodes.get(nodeId);
    if (!next) throw new Error('Working copy update failed');
    await syncPeerDataFromNode(next as TreeNode);
    return next;
  }

  async listWorkingCopies(): Promise<TreeNode[]> {
    // Drafts are nodes with draftData present
    const allNodes = await this.coreDB.nodes.toArray();
    return allNodes.filter((node) => node.draftData !== null && node.draftData !== undefined);
  }

  async hasWorkingCopy(nodeId: NodeId): Promise<boolean> {
    const wc = await getWc(this.coreDB, nodeId);
    return !!wc;
  }

  async commitWorkingCopy(
    workingCopyId: NodeId,
    options?: CommitWorkingCopyOptions
  ): Promise<CommitResult> {
    const conflictPolicy: OnNameConflict = options?.onNameConflict ?? 'auto-rename';
    const { commitDraft } = await import('./WorkingCopyTreeNodeOperations.js');
    const result = await commitDraft(this.coreDB, workingCopyId, conflictPolicy);
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

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    const wc = await getWc(this.coreDB, nodeId);
    if (!wc) return;
    await discardWc(this.coreDB, nodeId);
  }

  async discardAllWorkingCopies(): Promise<number> {
    const list = await this.listWorkingCopies();
    for (const wc of list) await discardWc(this.coreDB, wc.id as NodeId);
    return list.length;
  }

  async validateWorkingCopy(nodeId: NodeId): Promise<ValidationResult> {
    const exists = await getWc(this.coreDB, nodeId);
    return exists ? { valid: true } : { valid: false, message: 'Working copy not found' };
  }

  async hasUnsavedChanges(nodeId: NodeId): Promise<boolean> {
    return !!(await getWc(this.coreDB, nodeId));
  }

  async commitMultipleWorkingCopies(nodeIds: NodeId[]): Promise<CommitResult[]> {
    const results: CommitResult[] = [];
    for (const id of nodeIds) {
      const res = await this.commitWorkingCopy(id);
      results.push(res);
    }
    return results;
  }

  async createMultipleWorkingCopies(nodeIds: NodeId[]): Promise<TreeNode[]> {
    const results: TreeNode[] = [];
    for (const id of nodeIds) {
      const node = await this.coreDB.getNode(id);
      if (node) results.push(await this.createWorkingCopyFromNode(id));
    }
    return results;
  }

  async getWorkingCopyStats(): Promise<{
    total: number;
    drafts: number;
    edits: number;
    oldestTimestamp: number;
    newestTimestamp: number;
  }> {
    const list = await this.listWorkingCopies();
    const now = Date.now();
    return {
      total: list.length,
      drafts: list.length,
      edits: list.length,
      oldestTimestamp: list.reduce((min, x) => Math.min(min, x.updatedAt), now),
      newestTimestamp: list.reduce((max, x) => Math.max(max, x.updatedAt), 0),
    };
  }

  async cleanupOldWorkingCopies(olderThan: number): Promise<number> {
    const list = await this.listWorkingCopies();
    const toDelete = list.filter((x) => x.updatedAt < olderThan);
    for (const wc of toDelete) await discardWc(this.coreDB, wc.id as NodeId);
    return toDelete.length;
  }
}
