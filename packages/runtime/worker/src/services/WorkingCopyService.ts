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
import { getWorkingCopyCleaner, type WorkingCopyCleaner } from './WorkingCopyCleaner.js';
import {
  createDraftWorkingCopyGetOrCreate,
  createWorkingCopyFromNode as createWcFromNode,
  discardWorkingCopy as discardWc,
  getWorkingCopy as getWc,
  touchWorkingCopyByRecord,
  updateWorkingCopy as updateWc,
} from './WorkingCopyTreeNodeOperations.js';
import { syncPeerDataFromNode } from './peerDataRegistry.js';
import {
  commitWorkingCopyManually,
  getWorkingCopyContext,
  mapCommandProcessorResult,
  mapCommitResultV2,
} from './working-copy/commitCoordinator.js';

/**
 * WorkingCopyService - minimal implementation backed by EphemeralDB/CoreDB
 *
 * Note: This service returns only serializable data. It does not expose ProxyMarked types.
 */
export class WorkingCopyService implements WorkingCopyAPI {
  private readonly cleaner: WorkingCopyCleaner;

  constructor(
    private coreDB: CoreDB,
    _ephemeralDB: unknown,
    private commandProcessor?: CommandProcessor
  ) {
    this.cleaner = getWorkingCopyCleaner(this.coreDB);
    this.cleaner.start();
    this.cleaner
      .cleanStaleEntries()
      .catch((error) => console.warn('[WorkingCopyCleaner] initial sweep failed', error));
  }

  async createDraftWorkingCopy(
    nodeType: NodeType,
    parentId: NodeId,
    initialData?: Partial<TreeNode>
  ): Promise<TreeNode> {
    // Use holder-based create (get-or-create)
    const treeId = parentId.split(':')[0] as TreeId;
    const { wcNodeId } = await createDraftWorkingCopyGetOrCreate(
      this.coreDB,
      treeId,
      parentId,
      nodeType,
      initialData?.name?.trim() || resolveDefaultNodeName(nodeType)
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
      await touchWorkingCopyByRecord(this.coreDB, wc as TreeNode);
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
    // Dev path: scan holders and return children
    const allNodes = await this.coreDB.nodes.toArray();
    const holders = allNodes.filter((node) => node.holderType === 'workingCopy');
    const children: TreeNode[] = [];
    for (const holder of holders) {
      const child = allNodes.find((node) => node.parentId === holder.id);
      if (child) children.push(child);
    }
    return children;
  }

  async hasWorkingCopy(nodeId: NodeId): Promise<boolean> {
    const wc = await getWc(this.coreDB, nodeId);
    return !!wc;
  }

  async commitWorkingCopy(
    workingCopyId: NodeId,
    options?: CommitWorkingCopyOptions
  ): Promise<CommitResult> {
    const context = await getWorkingCopyContext(this.coreDB, workingCopyId);
    const conflictPolicy: OnNameConflict = options?.onNameConflict ?? 'auto-rename';

    if (this.commandProcessor) {
      try {
        const env = this.commandProcessor.createEnvelope('commitWorkingCopy', {
          workingCopyId,
          onNameConflict: conflictPolicy,
        });
        const res = await this.commandProcessor.processCommand(env);
        const mapped = await mapCommandProcessorResult(this.coreDB, res, context);
        if (mapped) {
          return mapped;
        }
      } catch {
        // fall back to direct path when the command processor path fails
      }
    }

    try {
      const { commitWorkingCopyV2 } = await import('./WorkingCopyTreeNodeOperations.js');
      const v2Result = await commitWorkingCopyV2(this.coreDB, workingCopyId, conflictPolicy);
      return await mapCommitResultV2(this.coreDB, v2Result, context);
    } catch {
      // Continue to manual fallback below if v2 path throws (e.g. metadata missing)
    }

    return commitWorkingCopyManually(this.coreDB, workingCopyId, context, conflictPolicy);
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    const wc = await getWc(this.coreDB, nodeId);
    if (!wc) return;
    await discardWc(this.coreDB, [wc.parentId, nodeId]);
  }

  async discardAllWorkingCopies(): Promise<number> {
    const list = await this.listWorkingCopies();
    for (const wc of list) await discardWc(this.coreDB, [wc.parentId as NodeId, wc.id as NodeId]);
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
      drafts: 0,
      edits: list.length,
      oldestTimestamp: list.reduce((min, x) => Math.min(min, x.updatedAt), now),
      newestTimestamp: list.reduce((max, x) => Math.max(max, x.updatedAt), 0),
    };
  }

  async cleanupOldWorkingCopies(olderThan: number): Promise<number> {
    const list = await this.listWorkingCopies();
    const toDelete = list.filter((x) => x.updatedAt < olderThan);
    for (const wc of toDelete)
      await discardWc(this.coreDB, [wc.parentId as NodeId, wc.id as NodeId]);
    return toDelete.length;
  }
}
