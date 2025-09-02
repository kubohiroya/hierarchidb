import type { WorkingCopyAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNode, NodeType, ValidationResult, CommitResult } from '@hierarchidb/common-type';
import { CoreDB } from './CoreDB';
import { EphemeralDB } from './EphemeralDB';
import { CommandProcessor } from './CommandProcessor';
import { FEATURE_FLAGS } from '../config/feature-flags';

/**
 * WorkingCopyService - minimal implementation backed by EphemeralDB/CoreDB
 *
 * Note: This service returns only serializable data. It does not expose ProxyMarked types.
 */
export class WorkingCopyService implements WorkingCopyAPI {
  constructor(private coreDB: CoreDB, private ephemeralDB: EphemeralDB, private commandProcessor?: CommandProcessor) {}

  async createDraftWorkingCopy(
    nodeType: NodeType,
    parentId: NodeId,
    initialData?: Partial<TreeNode>
  ): Promise<TreeNode> {
    const now = Date.now();
    // Create a draft working copy TreeNode shape stored in EphemeralDB
    const workingCopy: any = {
      id: (initialData?.id ?? (('wc-' + now) as NodeId)) as NodeId,
      parentId,
      nodeType,
      name: initialData?.name ?? `New ${nodeType}`,
      depth: initialData?.depth ?? 0,
      createdAt: now,
      updatedAt: now,
      version: (initialData?.version as number | undefined) ?? 1,
      ...initialData,
    } satisfies TreeNode as unknown as TreeNode; // shape compatibility

    await this.ephemeralDB.createWorkingCopy(workingCopy);
    return workingCopy as TreeNode;
  }

  async createWorkingCopyFromNode(nodeId: NodeId): Promise<TreeNode> {
    const node = await this.coreDB.getNode(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    const now = Date.now();
    const workingCopy: any = {
      ...node,
      updatedAt: now,
    };
    await this.ephemeralDB.createWorkingCopy(workingCopy);
    return workingCopy as TreeNode;
  }

  async getWorkingCopy(nodeId: NodeId): Promise<TreeNode | undefined> {
    return (await this.ephemeralDB.getWorkingCopy(nodeId)) as unknown as TreeNode | undefined;
  }

  async updateWorkingCopy(nodeId: NodeId, updates: Partial<TreeNode>): Promise<TreeNode> {
    const current = await this.ephemeralDB.getWorkingCopy(nodeId);
    if (!current) throw new Error(`Working copy for ${nodeId} not found`);
    const updated: any = { ...current, ...updates, updatedAt: Date.now() };
    await this.ephemeralDB.updateWorkingCopy(updated);
    return updated as TreeNode;
  }

  async listWorkingCopies(): Promise<TreeNode[]> {
    return (await this.ephemeralDB.listWorkingCopies()) as unknown as TreeNode[];
  }

  async hasWorkingCopy(nodeId: NodeId): Promise<boolean> {
    return !!(await this.ephemeralDB.getWorkingCopy(nodeId));
  }

  async commitWorkingCopy(nodeId: NodeId): Promise<CommitResult> {
    const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
    if (!workingCopy) return { success: false, error: 'Working copy not found' };
    // Prefer CP V2 when available/allowed, else fallback to legacy (ephemeral discard)
    if (this.commandProcessor && FEATURE_FLAGS.WORKER_WC_COMMIT_V2) {
      const env = this.commandProcessor.createEnvelope('commitWorkingCopy', { workingCopyId: nodeId } as any);
      const res = await this.commandProcessor.processCommand(env as any);
      return res.success ? { success: true } : { success: false, error: (res as any).error ?? 'Commit failed' };
    }
    await this.ephemeralDB.discardWorkingCopy(nodeId);
    return { success: true };
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    await this.ephemeralDB.discardWorkingCopy(nodeId);
  }

  async discardAllWorkingCopies(): Promise<number> {
    const all = await this.ephemeralDB.listWorkingCopies();
    for (const wc of all) await this.ephemeralDB.discardWorkingCopy(wc.id as NodeId);
    return all.length;
  }

  async validateWorkingCopy(nodeId: NodeId): Promise<ValidationResult> {
    const exists = await this.ephemeralDB.getWorkingCopy(nodeId);
    return exists ? { valid: true } : { valid: false, message: 'Working copy not found' };
  }

  async hasUnsavedChanges(nodeId: NodeId): Promise<boolean> {
    return !!(await this.ephemeralDB.getWorkingCopy(nodeId));
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
    const list = await this.ephemeralDB.listWorkingCopies();
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
    const list = await this.ephemeralDB.listWorkingCopies();
    const toDelete = list.filter((x) => x.updatedAt < olderThan);
    for (const wc of toDelete) await this.ephemeralDB.discardWorkingCopy(wc.id as NodeId);
    return toDelete.length;
  }
}
