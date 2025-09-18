import type { WorkingCopyAPI } from '@hierarchidb/common-api';
import type { CommitResult, NodeId, NodeType, TreeNode, ValidationResult } from '@hierarchidb/common-type';
import { CoreDB } from './CoreDB.js';
import {
  createDraftWorkingCopyGetOrCreate,
  createWorkingCopyFromNode as createWcFromNode,
  discardWorkingCopy as discardWc,
  getWorkingCopy as getWc,
  updateWorkingCopy as updateWc,
} from './WorkingCopyTreeNodeOperations.js';
import { CommandProcessor } from './CommandProcessor.js';

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

  async commitWorkingCopy(workingCopyId: NodeId): Promise<CommitResult> {
    const context = await this.getWorkingCopyContext(workingCopyId);

    // Prefer CommandProcessor V2 when available, otherwise call V2 helper directly.
    if (this.commandProcessor) {
      const env = this.commandProcessor.createEnvelope('commitWorkingCopy', { workingCopyId, onNameConflict: 'auto-rename' } as any);
      const res = await this.commandProcessor.processCommand(env as any);
      if (res.success) {
        const committed = await this.loadCommittedNode((res as any).nodeId as NodeId | undefined, context);
        return committed ? { success: true, node: committed } : { success: true };
      }
    }
    // Fallback: try direct V2 commit when CP is unavailable or fails
    try {
      const { commitWorkingCopyV2 } = await import('./WorkingCopyTreeNodeOperations.js');
      const r = await commitWorkingCopyV2(this.coreDB as any, workingCopyId, 'auto-rename');
      if (r.status === 'ok') {
        const committed = await this.loadCommittedNode(r.nodeId, context);
        return committed ? { success: true, node: committed } : { success: true };
      }
    } catch (e) {
      // fall through to manual path below
    }
    // Manual last-resort: create canonical node and discard WC
    try {
      const wcNode = context?.wcNode;
      const holder = context?.holder;
      let targetParentNodeId = context?.targetParentNodeId;
      let targetNodeId = context?.targetNodeId;
      if (!wcNode || !holder) return { success: false, error: 'Working copy not found' };
      if (!targetParentNodeId || !targetNodeId) return { success: false, error: 'Holder metadata missing' };
      const parent = await (this.coreDB as any).nodes.get(targetParentNodeId);
      if (!parent) return { success: false, error: 'Parent node not found' };
      // name conflict auto-rename
      const siblings = await (this.coreDB as any).listChildren(targetParentNodeId);
      const names = (siblings || []).map((n: any) => n.name);
      let finalName = wcNode.name;
      if (names.includes(finalName)) {
        const { createNewName } = await import('./WorkingCopyTreeNodeOperations.js');
        finalName = createNewName(names, finalName);
      }
      await (this.coreDB as any).createNode({ ...(wcNode as any), id: targetNodeId, parentId: targetParentNodeId, name: finalName });
      const { discardWorkingCopy } = await import('./WorkingCopyTreeNodeOperations.js');
      await discardWorkingCopy(this.coreDB as any, [holder.id, wcNode.id]);
      const committed = await this.loadCommittedNode(targetNodeId, context);
      return committed ? { success: true, node: committed } : { success: true };
    } catch (e) {
      const holderId = context?.wcNode?.parentId as NodeId | undefined;
      if (holderId) await discardWc(this.coreDB as any, [holderId, workingCopyId]);
      return { success: false, error: (e as Error)?.message || 'Commit failed' };
    }
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

  private async getWorkingCopyContext(workingCopyId: NodeId): Promise<{
    wcNode?: any;
    holder?: any;
    targetNodeId?: NodeId;
    targetParentNodeId?: NodeId;
  } | undefined> {
    try {
      const wcNode = await (this.coreDB as any).nodes.get(workingCopyId);
      if (!wcNode) return undefined;
      const holder = await (this.coreDB as any).nodes.get(wcNode.parentId);
      if (!holder) return { wcNode };
      let targetNodeId = holder.holderTargetId as NodeId | undefined;
      let targetParentNodeId = holder.holderMetaParentId as NodeId | undefined;
      if (!targetNodeId || !targetParentNodeId) {
        try {
          const { decodeWorkingCopyHolderName } = await import('./utils/holder-encoding.js');
          const parsed = decodeWorkingCopyHolderName(holder.name as string);
          targetNodeId = targetNodeId ?? (parsed.targetNodeId as NodeId);
          targetParentNodeId = targetParentNodeId ?? (parsed.targetParentNodeId as NodeId);
        } catch {
        }
      }
      return { wcNode, holder, targetNodeId, targetParentNodeId };
    } catch {
      return undefined;
    }
  }

  private async loadCommittedNode(explicitId: NodeId | undefined, context?: {
    targetNodeId?: NodeId;
  }): Promise<TreeNode | undefined> {
    const candidate = explicitId ?? context?.targetNodeId;
    if (!candidate) return undefined;
    const node = await this.coreDB.nodes.get(candidate);
    return node as TreeNode | undefined;
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
    for (const wc of toDelete) await discardWc(this.coreDB as any, [wc.parentId as NodeId, wc.id as NodeId]);
    return toDelete.length;
  }
}
