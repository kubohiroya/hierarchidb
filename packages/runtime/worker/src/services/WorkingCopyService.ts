import type { CommitWorkingCopyOptions, WorkingCopyAPI } from '@hierarchidb/common-api';
import type {
  CommandResult,
  CommitResult,
  OnNameConflict,
  NodeId,
  NodeType,
  TreeId,
  TreeNode,
  ValidationResult,
} from '@hierarchidb/common-types';
import type { CoreDB } from './CoreDB.js';
import {
  createDraftWorkingCopyGetOrCreate,
  createWorkingCopyFromNode as createWcFromNode,
  discardWorkingCopy as discardWc,
  getWorkingCopy as getWc,
  updateWorkingCopy as updateWc,
} from './WorkingCopyTreeNodeOperations.js';
import type { CommitResultV2 } from './WorkingCopyTreeNodeOperations.js';
import type { CommandProcessor } from './CommandProcessor.js';

/**
 * WorkingCopyService - minimal implementation backed by EphemeralDB/CoreDB
 *
 * Note: This service returns only serializable data. It does not expose ProxyMarked types.
 */
export class WorkingCopyService implements WorkingCopyAPI {
  constructor(private coreDB: CoreDB, _ephemeralDB: unknown, private commandProcessor?: CommandProcessor) {}

  async createDraftWorkingCopy(
    nodeType: NodeType,
    parentId: NodeId,
    initialData?: Partial<TreeNode>,
  ): Promise<TreeNode> {
    // Use holder-based create (get-or-create)
    const treeId = parentId.split(':')[0] as TreeId;
    const { wcNodeId } = await createDraftWorkingCopyGetOrCreate(
      this.coreDB,
      treeId,
      parentId,
      nodeType,
      initialData?.name ?? `New ${nodeType}`,
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
    return getWc(this.coreDB, nodeId);
  }

  async updateWorkingCopy(nodeId: NodeId, updates: Partial<TreeNode>): Promise<TreeNode> {
    const current = await getWc(this.coreDB, nodeId);
    if (!current) throw new Error(`Working copy for ${nodeId} not found`);
    await updateWc(this.coreDB, nodeId, { ...updates });
    const next = await this.coreDB.nodes.get(nodeId);
    if (!next) throw new Error('Working copy update failed');
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
    options?: CommitWorkingCopyOptions,
  ): Promise<CommitResult> {
    const context = await this.getWorkingCopyContext(workingCopyId);
    const conflictPolicy: OnNameConflict = options?.onNameConflict ?? 'auto-rename';

    if (this.commandProcessor) {
      try {
        const env = this.commandProcessor.createEnvelope('commitWorkingCopy', {
          workingCopyId,
          onNameConflict: conflictPolicy,
        });
        const res = await this.commandProcessor.processCommand(env);
        const mapped = await this.mapCommandProcessorResult(res, context);
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
      return await this.mapCommitResultV2(v2Result, context);
    } catch {
      // Continue to manual fallback below if v2 path throws (e.g. metadata missing)
    }

    return this.commitWorkingCopyManually(workingCopyId, context, conflictPolicy);
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    const wc = (await getWc(this.coreDB, nodeId));
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

  private async getWorkingCopyContext(workingCopyId: NodeId): Promise<WorkingCopyContext | undefined> {
    try {
      const wcNode = await this.coreDB.nodes.get(workingCopyId);
      if (!wcNode) return undefined;
      const holder = await this.coreDB.nodes.get(wcNode.parentId);
      if (!holder) return { wcNode };
      let targetNodeId = holder.holderTargetId as NodeId | undefined;
      let targetParentNodeId = holder.holderMetaParentId as NodeId | undefined;
      if (!targetNodeId || !targetParentNodeId) {
        try {
          const { decodeWorkingCopyHolderName } = await import('./utils/holder-encoding.js');
          const parsed = decodeWorkingCopyHolderName(holder.name);
          targetNodeId = targetNodeId ?? parsed.targetNodeId;
          targetParentNodeId = targetParentNodeId ?? parsed.targetParentNodeId;
        } catch {
        }
      }
      return { wcNode, holder, targetNodeId, targetParentNodeId };
    } catch {
      return undefined;
    }
  }

  private async loadCommittedNode(explicitId: NodeId | undefined, context?: WorkingCopyContext): Promise<TreeNode | undefined> {
    const candidate = explicitId ?? context?.targetNodeId;
    if (!candidate) return undefined;
    return this.coreDB.nodes.get(candidate) ?? undefined;
  }

  private async mapCommandProcessorResult(
    result: CommandResult,
    context?: WorkingCopyContext,
  ): Promise<CommitResult | undefined> {
    if (result.success) {
      const canonicalId = (result.nodeId as NodeId | undefined) ?? context?.targetNodeId;
      if (!canonicalId) {
        return undefined;
      }
      const autoRenameTo = 'autoRenameTo' in result ? result.autoRenameTo : undefined;
      return this.buildOkResult(canonicalId, context, autoRenameTo);
    }

    if (result.status === 'COMMIT_CONFLICT') {
      if (typeof result.originalVersion === 'number' && typeof result.wcVersion === 'number') {
        return {
          status: 'COMMIT_CONFLICT',
          originalVersion: result.originalVersion,
          wcVersion: result.wcVersion,
        };
      }
      return undefined;
    }

    if (result.status === 'NAME_CONFLICT' && typeof result.suggestedName === 'string') {
      return {
        status: 'NAME_CONFLICT',
        suggestedName: result.suggestedName,
      };
    }

    return undefined;
  }

  private async mapCommitResultV2(
    result: CommitResultV2,
    context?: WorkingCopyContext,
  ): Promise<CommitResult> {
    if (result.status === 'ok') {
      const canonicalId = result.nodeId ?? context?.targetNodeId;
      if (!canonicalId) {
        throw new Error('Committed node id not found');
      }
      return this.buildOkResult(canonicalId, context, result.autoRenameTo);
    }

    if (result.status === 'COMMIT_CONFLICT') {
      return {
        status: 'COMMIT_CONFLICT',
        originalVersion: result.originalVersion,
        wcVersion: result.wcVersion,
      };
    }

    return {
      status: 'NAME_CONFLICT',
      suggestedName: result.suggestedName,
    };
  }

  private async commitWorkingCopyManually(
    workingCopyId: NodeId,
    context: WorkingCopyContext | undefined,
    onNameConflict: OnNameConflict,
  ): Promise<CommitResult> {
    let resolvedContext: WorkingCopyContext | undefined;
    try {
      resolvedContext = await this.ensureWorkingCopyContext(workingCopyId, context);
      const { wcNode, holder, targetNodeId, targetParentNodeId } = resolvedContext;

      if (!wcNode || !holder) {
        throw new Error('Working copy not found');
      }
      if (!targetParentNodeId || !targetNodeId) {
        throw new Error('Holder metadata missing');
      }

      const parent = await this.coreDB.nodes.get(targetParentNodeId);
      if (!parent) {
        throw new Error('Parent node not found');
      }

      const { createNewName, discardWorkingCopy, getChildNames } = await import(
        './WorkingCopyTreeNodeOperations.js'
      );

      const siblingNames = await getChildNames(this.coreDB, targetParentNodeId);
      const nameConflicts = siblingNames.includes(wcNode.name);
      const suggestedName = nameConflicts ? createNewName(siblingNames, wcNode.name) : undefined;

      const existingNode = await this.coreDB.nodes.get(targetNodeId);
      const now = Date.now();

      if (!existingNode) {
        if (nameConflicts && onNameConflict === 'error' && suggestedName) {
          return { status: 'NAME_CONFLICT', suggestedName };
        }

        const finalName =
          nameConflicts && onNameConflict === 'auto-rename' && suggestedName ? suggestedName : wcNode.name;

        await this.coreDB.createNode({
          ...wcNode,
          id: targetNodeId,
          parentId: targetParentNodeId,
          name: finalName,
          updatedAt: now,
          version: (wcNode.version || 1) + 1,
        });

        await discardWorkingCopy(this.coreDB, [holder.id, wcNode.id]);
        const autoRenameTo = finalName !== wcNode.name ? finalName : undefined;
        return this.buildOkResult(targetNodeId, resolvedContext, autoRenameTo);
      }

      const wcVersion = wcNode.version ?? 1;
      const originalVersion = existingNode.version ?? 1;
      if (originalVersion > wcVersion) {
        return {
          status: 'COMMIT_CONFLICT',
          originalVersion,
          wcVersion,
        };
      }

      if (nameConflicts && onNameConflict === 'error' && suggestedName) {
        return {
          status: 'NAME_CONFLICT',
          suggestedName,
        };
      }

      const finalName =
        nameConflicts && onNameConflict === 'auto-rename' && suggestedName ? suggestedName : wcNode.name;

      await this.coreDB.updateNode({
        ...wcNode,
        id: targetNodeId,
        parentId: targetParentNodeId,
        name: finalName,
        updatedAt: now,
        version: wcVersion + 1,
      });

      await discardWorkingCopy(this.coreDB, [holder.id, wcNode.id]);
      const autoRenameTo = finalName !== wcNode.name ? finalName : undefined;
      return this.buildOkResult(targetNodeId, resolvedContext, autoRenameTo);
    } catch (error) {
      const holderId =
        resolvedContext?.wcNode?.parentId ?? context?.wcNode?.parentId ??
        (resolvedContext?.holder?.id as NodeId | undefined);
      if (holderId) {
        await discardWc(this.coreDB, [holderId, workingCopyId]);
      }
      throw error instanceof Error ? error : new Error('Commit failed');
    }
  }

  private async ensureWorkingCopyContext(
    workingCopyId: NodeId,
    context: WorkingCopyContext | undefined,
  ): Promise<WorkingCopyContext> {
    if (
      context?.wcNode &&
      context.holder &&
      context.targetNodeId &&
      context.targetParentNodeId
    ) {
      return context;
    }

    const wcNode = context?.wcNode ?? (await this.coreDB.nodes.get(workingCopyId));
    if (!wcNode) {
      throw new Error('Working copy not found');
    }
    const holder =
      context?.holder ?? ((await this.coreDB.nodes.get(wcNode.parentId)) as WorkingCopyHolderNode | undefined);
    if (!holder) {
      throw new Error('Working copy holder not found');
    }

    let targetNodeId = context?.targetNodeId ?? holder.holderTargetId;
    let targetParentNodeId = context?.targetParentNodeId ?? holder.holderMetaParentId;
    if (!targetNodeId || !targetParentNodeId) {
      try {
        const { decodeWorkingCopyHolderName } = await import('./utils/holder-encoding.js');
        const parsed = decodeWorkingCopyHolderName(holder.name);
        targetNodeId = targetNodeId ?? (parsed.targetNodeId as NodeId);
        targetParentNodeId = targetParentNodeId ?? (parsed.targetParentNodeId as NodeId);
      } catch {
        // noop: fallback to metadata checks below
      }
    }

    if (!targetNodeId || !targetParentNodeId) {
      throw new Error('Holder metadata missing');
    }

    return {
      wcNode,
      holder,
      targetNodeId,
      targetParentNodeId,
    };
  }

  private async buildOkResult(
    nodeId: NodeId,
    context?: WorkingCopyContext,
    autoRenameTo?: string,
  ): Promise<CommitResult> {
    const committed = await this.loadCommittedNode(nodeId, context);
    return {
      status: 'ok',
      nodeId,
      node: committed,
      autoRenameTo,
    };
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
    for (const wc of toDelete) await discardWc(this.coreDB, [wc.parentId as NodeId, wc.id as NodeId]);
    return toDelete.length;
  }
}

type WorkingCopyHolderNode = TreeNode & {
  holderType?: 'workingCopy' | 'trash';
  holderTargetId?: NodeId;
  holderMetaParentId?: NodeId;
};

type WorkingCopyContext = {
  wcNode?: TreeNode;
  holder?: WorkingCopyHolderNode;
  targetNodeId?: NodeId;
  targetParentNodeId?: NodeId;
};
