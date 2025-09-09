import type { WorkingCopyAPI } from '@hierarchidb/common-api';
import type { CommitResult, NodeId, NodeType, TreeNode, ValidationResult } from '@hierarchidb/common-type';
import { CoreDB } from './CoreDB';
import {
  createDraftWorkingCopyGetOrCreate,
  createWorkingCopyFromNode as createWcFromNode,
  discardWorkingCopy as discardWc,
  getWorkingCopy as getWc,
  updateWorkingCopy as updateWc,
} from './WorkingCopyTreeNodeOperations';
import { CommandProcessor } from './CommandProcessor';
import { FEATURE_FLAGS } from '../config/feature-flags';

/**
 * WorkingCopyService - minimal implementation backed by EphemeralDB/CoreDB
 *
 * Note: This service returns only serializable data. It does not expose ProxyMarked types.
 */
export class WorkingCopyService implements WorkingCopyAPI {
  constructor(private coreDB: CoreDB, _ephemeralDB: unknown, private commandProcessor?: CommandProcessor) {
  }

  async createDraftWorkingCopy(
    nodeType: NodeType,
    parentId: NodeId,
    initialData?: Partial<TreeNode>,
  ): Promise<TreeNode> {
    // Use holder-based create (get-or-create)
    const treeId = (parentId.split(':')[0] as unknown) as any; // expected 'r'|'p' format
    const { wcNodeId } = await createDraftWorkingCopyGetOrCreate(this.coreDB as any, treeId, parentId, nodeType, initialData?.name ?? `New ${nodeType}`);
    const wc = (await this.coreDB.nodes.get(wcNodeId)) as unknown as TreeNode;
    return wc;
  }

  async createWorkingCopyFromNode(nodeId: NodeId): Promise<TreeNode> {
    const treeId = (nodeId.split(':')[0] as unknown) as any;
    await createWcFromNode(this.coreDB as any, treeId, nodeId);
    const wc = await getWc(this.coreDB as any, nodeId);
    if (!wc) throw new Error('Working copy not created');
    return wc as TreeNode;
  }

  async getWorkingCopy(nodeId: NodeId): Promise<TreeNode | undefined> {
    return (await getWc(this.coreDB as any, nodeId)) as unknown as TreeNode | undefined;
  }

  async updateWorkingCopy(nodeId: NodeId, updates: Partial<TreeNode>): Promise<TreeNode> {
    const current = (await getWc(this.coreDB as any, nodeId)) as any;
    if (!current) throw new Error(`Working copy for ${nodeId} not found`);
    await updateWc(this.coreDB as any, nodeId, { ...updates });
    const next = (await this.coreDB.nodes.get(nodeId)) as any;
    return next as TreeNode;
  }

  async listWorkingCopies(): Promise<TreeNode[]> {
    // Dev path: scan holders and return children
    const all: any[] = ((await (this.coreDB.nodes as any).toArray?.()) as any[]) || [];
    const holders = all.filter((n) => n?.holderType === 'workingCopy');
    const children: any[] = [];
    for (const h of holders) {
      const child = all.find((n) => n?.parentId === h.id);
      if (child) children.push(child);
    }
    return children as TreeNode[];
  }

  async hasWorkingCopy(nodeId: NodeId): Promise<boolean> {
    return !!(await getWc(this.coreDB as any, nodeId));
  }

  async commitWorkingCopy(nodeId: NodeId): Promise<CommitResult> {
    const workingCopy = (await getWc(this.coreDB as any, nodeId)) as any;
    if (!workingCopy) return { success: false, error: 'Working copy not found' };
    // Prefer CP V2 when available/allowed, else fallback to legacy (ephemeral discard)
    if (this.commandProcessor && FEATURE_FLAGS.WORKER_WC_COMMIT_V2) {
      const env = this.commandProcessor.createEnvelope('commitWorkingCopy', { workingCopyId: nodeId } as any);
      const res = await this.commandProcessor.processCommand(env as any);
      return res.success ? { success: true } : { success: false, error: (res as any).error ?? 'Commit failed' };
    }
    await discardWc(this.coreDB as any, [workingCopy.parentId, nodeId]);
    return { success: true };
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    const wc = (await getWc(this.coreDB as any, nodeId)) as any;
    if (!wc) return;
    await discardWc(this.coreDB as any, [wc.parentId, nodeId]);
  }

  async discardAllWorkingCopies(): Promise<number> {
    const list = await this.listWorkingCopies();
    for (const wc of list) await discardWc(this.coreDB as any, [wc.parentId as NodeId, wc.id as NodeId]);
    return list.length;
  }

  async validateWorkingCopy(nodeId: NodeId): Promise<ValidationResult> {
    const exists = await getWc(this.coreDB as any, nodeId);
    return exists ? { valid: true } : { valid: false, message: 'Working copy not found' };
  }

  async hasUnsavedChanges(nodeId: NodeId): Promise<boolean> {
    return !!(await getWc(this.coreDB as any, nodeId));
  }

  async commitMultipleWorkingCopies(nodeIds: NodeId[]): Promise<CommitResult[]> {
    const results: CommitResult[] = [];
    for (const id of nodeIds) results.push(await this.commitWorkingCopy(id));
    return results;
  }

  async createMultipleWorkingCopies(nodeIds: NodeId[]): Promise<TreeNode[]> {
    const results: TreeNode[] = [];
    for (const id of nodeIds) {
      try {
        const node = await this.coreDB.getNode(id);
        if (node) results.push(await this.createWorkingCopyFromNode(id));
      } catch {
        // skip
      }
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
    for (const wc of toDelete) await discardWc(this.coreDB as any, [wc.parentId as NodeId, wc.id as NodeId]);
    return toDelete.length;
  }
}
