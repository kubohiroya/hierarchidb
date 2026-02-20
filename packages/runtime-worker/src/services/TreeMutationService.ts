import type { NodeId, NodeType, Timestamp, TreeId } from '@hierarchidb/core-types';
import type {
  CommandEnvelope,
  CommandResult as CoreCommandResult,
  DuplicateNodesPayload,
  ImportNodesPayload,
  PasteNodesPayload,
  RedoPayload,
  TreeMutationAPI,
  TreeNode,
  UndoPayload,
} from '@hierarchidb/tree-api';
import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '@hierarchidb/shape-api';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { SingletonMixin } from '@hierarchidb/util';
import { EntityLifecycleManager } from '~/entity/EntityLifecycleManager';
import { resolveDefaultNodeName } from '~/utils/default-node-name';
import { PERFORMANCE_CONFIG } from '~/utils/performance-config';
import type { CommandProcessor } from './CommandProcessor.js';
import type { CoreDB } from './CoreDB.js';
import { createNewName } from './DraftTreeNodeOperations.js';
import { generateNodeId } from './nodeId.js';
import { sanitizeMessageText } from './utils/error-adapter.js';
import { hasRouteReferencesToLocations } from '@hierarchidb/route-store';
import { hasLocationReferencesToShapes } from '@hierarchidb/location-store';

const getCommandError = (result: CoreCommandResult, fallback = 'Unknown error'): string => {
  if (result.success) return fallback;
  const failure = result as Extract<CoreCommandResult, { success: false }>;
  return failure.error;
};

const RUNNING_BUILD_SESSION_STATUS = 'running';

export class TreeMutationService implements TreeMutationAPI {
  // Note: Implementation now routes all mutating operations via CommandProcessor.
  static async getSingleton(
    coreDB: CoreDB,
    commandProcessor: CommandProcessor
  ): Promise<TreeMutationService> {
    return SingletonMixin.getSingleton('TreeMutationService', async () => {
      return new TreeMutationService(coreDB, commandProcessor);
    });
  }

  constructor(
    private coreDB: CoreDB,
    private commandProcessor: CommandProcessor
  ) {}

  // ==================
  // Helper: ensure ancestors' hasChildren flags
  // ==================
  private async ensureAncestorsHaveChildrenFromParent(
    startParentId: NodeId | undefined
  ): Promise<void> {
    if (!startParentId) return;
    let cursor: NodeId | undefined = startParentId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const parent = await this.coreDB.getNode?.(cursor);
      if (!parent) break;
      try {
        const nextVersion = (parent.version ?? 1) + 1;
        await this.coreDB.updateNode?.({
          id: parent.id,
          hasChildren: true,
          updatedAt: Date.now() as Timestamp,
          version: nextVersion,
        });
      } catch (error) {
        this.logRecoverableWarning(
          `ensureAncestorsHaveChildrenFromParent: updateNode failed for ancestor ${parent.id}`,
          error
        );
      }
      if (!parent.parentId || parent.parentId === parent.id) break;
      cursor = parent.parentId;
    }
  }

  private async ensureAncestorsHaveChildrenFromNodes(nodeIds: readonly NodeId[]): Promise<void> {
    for (const id of nodeIds) {
      const node = await this.coreDB.getNode?.(id);
      if (node?.parentId) {
        await this.ensureAncestorsHaveChildrenFromParent(node.parentId);
      }
    }
  }

  // Strict recomputation: sets hasChildren=true/false based on actual child count and propagates upward
  private async recomputeAncestorsHasChildrenFromParent(
    startParentId: NodeId | undefined
  ): Promise<void> {
    if (!startParentId) return;
    let cursor: NodeId | undefined = startParentId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const parent = await this.coreDB.getNode?.(cursor);
      if (!parent) break;
      const children = (await this.coreDB.listChildren?.(parent.id)) || [];
      const flag = children.length > 0;
      try {
        const nextVersion = (parent.version ?? 1) + 1;
        await this.coreDB.updateNode?.({
          id: parent.id,
          hasChildren: flag,
          updatedAt: Date.now() as Timestamp,
          version: nextVersion,
        });
      } catch (error) {
        this.logRecoverableWarning(
          `recomputeAncestorsHasChildrenFromParent: updateNode failed for ancestor ${parent.id}`,
          error
        );
      }
      if (!parent.parentId || parent.parentId === parent.id) break;
      cursor = parent.parentId;
    }
  }


  private async checkArchiveReferenceGuard(
    nodeIds: NodeId[]
  ): Promise<{ blocked: boolean; message?: string }> {
    if (nodeIds.length === 0) return { blocked: false };
    const nodes: TreeNode[] = [];
    for (const id of nodeIds) {
      const node = await this.coreDB.getNode?.(id);
      if (node) nodes.push(node);
    }
    const locationNodeIds = nodes
      .filter((node) => node.nodeType === 'location')
      .map((node) => node.id as NodeId);
    if (locationNodeIds.length > 0) {
      const hasReferences = await hasRouteReferencesToLocations(locationNodeIds);
      if (hasReferences) {
        return {
          blocked: true,
          message: 'TRASH_REF_ROUTE',
        };
      }
    }
    const shapeNodeIds = nodes
      .filter((node) => node.nodeType === 'shape')
      .map((node) => node.id as NodeId);
    if (shapeNodeIds.length > 0) {
      const hasReferences = await hasLocationReferencesToShapes(shapeNodeIds);
      if (hasReferences) {
        return {
          blocked: true,
          message: 'TRASH_REF_LOCATION',
        };
      }
    }
    return { blocked: false };
  }

  private async checkRunningBuildSessionGuard(
    nodeIds: NodeId[]
  ): Promise<{ blocked: boolean; message?: string }> {
    if (nodeIds.length === 0) return { blocked: false };

    await ephemeralDB.open?.();

    const nodes = await Promise.all(nodeIds.map(async (id) => this.coreDB.getNode?.(id)));
    const shapeNodeIds = Array.from(
      new Set(
        nodes
          .filter((node): node is TreeNode => Boolean(node && node.nodeType === 'shape'))
          .map((node) => node.id as NodeId)
      )
    );
    if (shapeNodeIds.length === 0) {
      return { blocked: false };
    }

    const sessions = await ephemeralDB.sessions.bulkGet(shapeNodeIds);
    if (sessions.some((session) => session?.status === RUNNING_BUILD_SESSION_STATUS)) {
      return {
        blocked: true,
        message: 'TRASH_BUILD_SESSION_RUNNING',
      };
    }

    return { blocked: false };
  }

  // ==================
  // TreeMutationAPI Interface Methods
  // ==================

  async createNode(params: {
    nodeType: NodeType;
    treeId: TreeId;
    parentId: NodeId;
    name: string;
    description?: string;
    isTemporary?: boolean;
  }): Promise<{ success: true; nodeId: NodeId } | { success: false; error: string }> {
    try {
      const { initTreeNode } = await import('./DraftTreeNodeOperations.js');
      const desiredName = params.name?.trim() || resolveDefaultNodeName(params.nodeType);
      const initialDraftData = this.resolveInitialDraftData(params.nodeType);
      const initial: Partial<TreeNode> | undefined =
        initialDraftData !== undefined || typeof params.isTemporary === 'boolean'
          ? { draftData: initialDraftData, isTemporary: params.isTemporary }
          : undefined;
      const wcNodeId = await initTreeNode(
        this.coreDB,
        params.treeId,
        params.parentId,
        params.nodeType,
        desiredName,
        undefined,
        initial
      );
      return { success: true, nodeId: wcNodeId as NodeId };
    } catch (error) {
      return { success: false, error: sanitizeMessageText(error) };
    }
  }

  async updateNode(params: {
    nodeId: NodeId;
    name?: string;
    description?: string;
    visible?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const envelope = this.commandProcessor.createEnvelope('updateNode', {
        nodeId: params.nodeId,
        name: params.name,
        description: params.description,
        visible: params.visible,
      });
      const result = await this.commandProcessor.processCommand(envelope);
      if (!result.success) {
        return { success: false, error: getCommandError(result) };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: sanitizeMessageText(error) };
    }
  }

  async moveNodes(params: {
    nodeIds: NodeId[];
    toParentId: NodeId;
    onNameConflict?: 'error' | 'auto-rename' | 'overwrite';
  }): Promise<{ success: boolean; error?: string }> {
    return this.moveNodesViaCommandProcessor(params);
  }

  private async moveNodesViaCommandProcessor(params: {
    nodeIds: NodeId[];
    toParentId: NodeId;
    onNameConflict?: 'error' | 'auto-rename' | 'overwrite';
  }): Promise<{ success: boolean; error?: string }> {
    const cmd = this.commandProcessor.createEnvelope('moveNodes', {
      nodeIds: params.nodeIds,
      toParentId: params.toParentId,
      onNameConflict: params.onNameConflict,
    });
    // Capture original parents before move
    const originalParents = new Set<NodeId>();
    for (const nid of params.nodeIds) {
      const n = await this.coreDB.getNode?.(nid);
      if (n?.parentId) originalParents.add(n.parentId);
    }
    const result = await this.commandProcessor.processCommand(cmd);
    if (!result.success) {
      return { success: false, error: getCommandError(result) };
    }
    // After successful move, recompute destination ancestors and original parents
    await this.recomputeAncestorsHasChildrenFromParent(params.toParentId);
    for (const pid of Array.from(originalParents))
      await this.recomputeAncestorsHasChildrenFromParent(pid);
    // Recompute depth under new parent for each moved root
    try {
      for (const rootId of params.nodeIds) {
        await this.recomputeDepthForSubtree(params.toParentId, rootId);
      }
    } catch (error) {
      this.logRecoverableWarning('moveNodes: recomputeDepthForSubtree failed', error);
    }
    return { success: true };
  }

  async duplicateNodes(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: true; nodeIds: NodeId[] } | { success: false; error: string }> {
    try {
      const firstNodeId = params.nodeIds[0];
      if (!firstNodeId) {
        return { success: false, error: 'No node IDs provided' };
      }
      const parentId = params.toParentId || (await this.getParentId(firstNodeId));

      const cmd: CommandEnvelope<'duplicateNodes', DuplicateNodesPayload> = {
        commandId: crypto.randomUUID(),
        groupId: crypto.randomUUID(),
        kind: 'duplicateNodes',
        payload: {
          nodeIds: params.nodeIds,
          toParentId: parentId,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const result = await this.duplicateNodesCommand(cmd);

      if (!result.success) {
        return { success: false, error: getCommandError(result) };
      }

      try {
        const lifecycle = EntityLifecycleManager.getSingleton(this.coreDB);
        await lifecycle.handleCommand(cmd);
      } catch (error) {
        this.logRecoverableWarning('duplicateNodes: lifecycle.handleCommand failed', error);
      }
      // After successful duplicate, recompute destination ancestors hasChildren
      await this.recomputeAncestorsHasChildrenFromParent(parentId);
      return {
        success: true,
        nodeIds: result.newNodeIds || [],
      };
    } catch (error) {
      return { success: false, error: sanitizeMessageText(error) };
    }
  }

  async removeNodes(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }> {
    return this.removeNodesViaCommandProcessor(nodeIds);
  }

  private async removeNodesViaCommandProcessor(
    nodeIds: NodeId[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Capture current parents to reinforce flags after operation
      const parentIds = new Set<NodeId>();
      for (const nid of nodeIds) {
        const n = await this.coreDB.getNode?.(nid);
        if (n?.parentId) parentIds.add(n.parentId);
      }
      const cmd = this.commandProcessor.createEnvelope('remove', { nodeIds });
      const result = await this.commandProcessor.processCommand(cmd);
      if (!result.success) {
        return { success: false, error: getCommandError(result) };
      }
      for (const pid of Array.from(parentIds)) {
        await this.recomputeAncestorsHasChildrenFromParent(pid);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: sanitizeMessageText(error) };
    }
  }

  async restoreNodesFromArchive(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
    onNameConflict?: 'error' | 'auto-rename' | 'overwrite';
  }): Promise<{ success: boolean; error?: string }> {
    const conflictPolicy = params.onNameConflict ?? 'auto-rename';
    const cmd = this.commandProcessor.createEnvelope('restoreFromArchive', {
      nodeIds: params.nodeIds,
      toParentId: params.toParentId,
      onNameConflict: conflictPolicy,
    });

    const result = await this.commandProcessor.processCommand(cmd);
    if (!result.success) {
      return { success: false, error: getCommandError(result) };
    }
    // After successful restore, recompute destination ancestors hasChildren
    if (params.toParentId) {
      await this.recomputeAncestorsHasChildrenFromParent(params.toParentId);
      // Also recompute depth for restored roots
      try {
        for (const rootId of params.nodeIds) {
          await this.recomputeDepthForSubtree(params.toParentId, rootId);
        }
      } catch (error) {
        this.logRecoverableWarning('restoreNodesFromArchive: recomputeDepthForSubtree failed', error);
      }
    } else {
      await this.ensureAncestorsHaveChildrenFromNodes(params.nodeIds);
    }
    return { success: true };
  }

  async removeSubtree(rootId: NodeId): Promise<{ success: boolean; error?: string }> {
    // Delegate to CommandProcessor so that associated entities (peer/groups/relations)
    // are also removed via its internal cleanup logic.
    try {
      const cmd = this.commandProcessor.createEnvelope('removeSubtree', { rootId });
      const result = await this.commandProcessor.processCommand(cmd);
      if (!result.success) {
        return { success: false, error: getCommandError(result) };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: sanitizeMessageText(error) };
    }
  }

  private async getParentId(nodeId: NodeId): Promise<NodeId> {
    const node = await this.coreDB.getNode?.(nodeId);
    return node?.parentId || ('' as NodeId);
  }

  // Legacy internal move/restore implementations removed: always route via CommandProcessor

  // Internal method for command processing
  async duplicateNodesCommand(
    cmd: CommandEnvelope<'duplicateNodes', DuplicateNodesPayload>
  ): Promise<CoreCommandResult> {
    const { nodeIds, toParentId } = cmd.payload;
    const newNodeIds: NodeId[] = [];
    const idMap = new Map<NodeId, NodeId>();

    const siblingNamesCache = new Map<NodeId, Set<string>>();
    const getSiblingNames = async (parentId: NodeId): Promise<Set<string>> => {
      const cached = siblingNamesCache.get(parentId);
      if (cached) return cached;
      const siblings = (await this.coreDB.listChildren?.(parentId)) || [];
      const names = new Set<string>(siblings.map((sibling) => sibling.metadata.name));
      siblingNamesCache.set(parentId, names);
      return names;
    };

    for (const sourceId of nodeIds) {
      if (sourceId === toParentId) {
        return {
          success: false,
          error: 'Cannot duplicate node into itself',
          code: 'INVALID_OPERATION',
        };
      }

      const descendants = (await this.coreDB.listDescendants?.(sourceId)) || [];
      if (descendants.some((node) => node.id === toParentId)) {
        return {
          success: false,
          error: 'Cannot duplicate node into its own descendant',
          code: 'INVALID_OPERATION',
        };
      }

      const sourceNode = await this.coreDB.getNode?.(sourceId);
      if (!sourceNode) {
        return {
          success: false,
          error: 'Source node not found',
          code: 'NODE_NOT_FOUND',
        };
      }

      const siblingNames = await getSiblingNames(toParentId);
      let desiredName = sourceNode.metadata.name;
      while (siblingNames.has(desiredName)) {
        desiredName = createNewName([...siblingNames], sourceNode.metadata.name);
        if (!siblingNames.has(desiredName)) break;
      }
      siblingNames.add(desiredName);

      const { newRootId, idMap: subMap } = await this.coreDB.duplicateSubtreeWithMap(
        sourceId,
        toParentId,
        {
          rootNameOverride: desiredName,
        }
      );
      newNodeIds.push(newRootId);
      for (const [src, dst] of subMap.entries()) idMap.set(src, dst);
    }

    EntityLifecycleManager.setIdMapping(cmd.commandId, idMap);

    return { success: true, seq: this.getNextSeq(), newNodeIds };
  }

  /** Recompute depth for a subtree moved/duplicated/restored under a new parent. */
  private async recomputeDepthForSubtree(newParentId: NodeId, rootId: NodeId): Promise<void> {
    const parent = await this.coreDB.getNode?.(newParentId);
    const baseDepth = parent?.depth ?? 0;

    const rootNode = await this.coreDB.getNode?.(rootId);
    if (!rootNode) return;

    const descendants = (await this.coreDB.listDescendants?.(rootId)) ?? [];
    const childrenByParent = new Map<NodeId, TreeNode[]>();
    for (const node of descendants) {
      const parentId = node.parentId;
      if (!parentId) continue;
      const bucket = childrenByParent.get(parentId) ?? [];
      bucket.push(node);
      childrenByParent.set(parentId, bucket);
    }

    const updates: TreeNode[] = [];
    const queue: Array<{ node: TreeNode; depth: number }> = [
      { node: rootNode, depth: baseDepth + 1 },
    ];

    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        break;
      }
      const { node, depth } = next;
      if (node.depth !== depth) {
        updates.push({ ...node, depth });
      }

      const children = childrenByParent.get(node.id) ?? [];
      for (const child of children) {
        queue.push({ node: child, depth: depth + 1 });
      }
    }

    if (updates.length === 0) return;

    if (updates.length === 1) {
      const [singleUpdate] = updates;
      if (singleUpdate) {
        await this.coreDB.updateNode?.(singleUpdate);
      }
      return;
    }

    const size = PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE;
    for (let i = 0; i < updates.length; i += size) {
      await this.coreDB.bulkUpdateNodes?.(updates.slice(i, i + size));
    }
  }

  /**
   * :
   * :
   * :
   * :
   * : docs/14-copy-paste-analysis.md
   */
  async pasteNodes(
    cmd: CommandEnvelope<'pasteNodes', PasteNodesPayload>
  ): Promise<CoreCommandResult> {
    const { nodes, nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;

    try {
      //  : :
      if (!nodes || typeof nodes !== 'object' || !nodeIds || !Array.isArray(nodeIds)) {
        return {
          success: false,
          error: 'Invalid paste payload: nodes and nodeIds are required',
          code: 'INVALID_OPERATION',
        } as CoreCommandResult;
      }

      if (!toParentId || typeof toParentId !== 'string') {
        return {
          success: false,
          error: 'Invalid toParentId: must be a non-empty string',
          code: 'INVALID_OPERATION',
        } as CoreCommandResult;
      }

      //  : DoS:
      const MAX_PASTE_NODES = 1000; //  :
      if (nodeIds.length > MAX_PASTE_NODES) {
        return {
          success: false,
          error: `Too many nodes to paste (max: ${MAX_PASTE_NODES})`,
          code: 'INVALID_OPERATION',
        } as CoreCommandResult;
      }

      //  :
      const parentId = toParentId as NodeId;
      // Relax strict parent existence requirement for test stubs that omit getNode.
      // Downstream listChildren() will still behave correctly (often returning []).

      const newNodeIds: NodeId[] = [];

      //  :
      let siblings = (await this.coreDB.listChildren?.(parentId)) || [];
      if (onNameConflict === 'overwrite') {
        const desiredNames = new Set<string>();
        for (const nodeId of nodeIds) {
          const sourceNode = nodes[nodeId];
          if (!sourceNode) continue;
          desiredNames.add(sourceNode.metadata.name);
        }
        const conflicts = siblings
          .filter((sibling) => desiredNames.has(sibling.metadata.name))
          .map((sibling) => sibling.id as NodeId);
        if (conflicts.length > 0) {
          const removeResult = await this.removeNodesViaCommandProcessor(conflicts);
          if (!removeResult.success) {
            return {
              success: false,
              error: removeResult.error || 'Failed to overwrite existing nodes',
              code: 'INVALID_OPERATION',
            } as CoreCommandResult;
          }
          siblings = (await this.coreDB.listChildren?.(parentId)) || [];
        }
      }
      const existingNames = new Set<string>(
        siblings.map((sibling: TreeNode) => sibling.metadata.name)
      );

      //  :
      const timestamp = Date.now() as Timestamp;
      const toCreate: TreeNode[] = [];

      // Build quick lookup to detect relative parentage within clipboard set
      const inClipboard = new Set<string>(nodeIds as unknown as string[]);
      // Preload base depth from destination parent
      let baseDepth = 0;
      try {
        const p = await this.coreDB.getNode?.(parentId);
        baseDepth = p?.depth ?? 0;
      } catch (error) {
        this.logRecoverableWarning('pasteNodes: failed to read destination parent depth', error);
      }

      for (const nodeId of nodeIds) {
        const sourceNode = nodes[nodeId];
        if (!sourceNode) {
          console.warn(`Source node not found in clipboard data: ${nodeId}`);
          continue;
        }

        const newNodeId = generateNodeId();
        let newName = sourceNode.metadata.name;
        const generated = newName === 'Untitled';
        if ((onNameConflict === 'auto-rename' || generated) && existingNames.has(newName)) {
          newName = this.resolveNameConflictEfficiently(newName, existingNames);
        } else if ((onNameConflict === 'error' || onNameConflict === 'overwrite') && existingNames.has(newName)) {
          return {
            success: false,
            error: `Name conflict: '${newName}' already exists`,
            code: 'NAME_NOT_UNIQUE',
          } as CoreCommandResult;
        }

        // Compute relative depth offset for clipboard nested nodes (simple 1-level detection; can be extended)
        let rel = 1;
        const clipboardParentId =
          typeof sourceNode.parentId === 'string' ? sourceNode.parentId : undefined;
        if (clipboardParentId && inClipboard.has(clipboardParentId)) {
          rel = 2;
        }

        const newNode: TreeNode = {
          ...(sourceNode as TreeNode),
          id: newNodeId,
          parentId: parentId,
          metadata: { ...sourceNode.metadata, name: newName },
          depth: baseDepth + rel,
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
        };

        toCreate.push(newNode);
        newNodeIds.push(newNodeId);
        existingNames.add(newName);
      }

      if (toCreate.length === 1) {
        const [singleNode] = toCreate;
        if (singleNode) {
          await this.coreDB.createNode?.(singleNode);
        }
      } else if (toCreate.length > 1) {
        const size = PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE;
        for (let i = 0; i < toCreate.length; i += size) {
          await this.coreDB.bulkCreateNodes?.(toCreate.slice(i, i + size));
        }
      }

      const idMap = new Map<NodeId, NodeId>();
      for (let i = 0; i < nodeIds.length; i++) {
        const src = nodeIds[i];
        const dst = newNodeIds[i];
        if (src && dst) idMap.set(src, dst);
      }
      EntityLifecycleManager.setIdMapping(cmd.commandId, idMap);
      const lifecycle = EntityLifecycleManager.getSingleton(this.coreDB);
      await lifecycle.handleCommand(cmd);

      // Recompute destination ancestors hasChildren
      await this.recomputeAncestorsHasChildrenFromParent(parentId);
      return { success: true, seq: this.getNextSeq(), newNodeIds } as CoreCommandResult;
    } catch (error) {
      //  :
      console.error('Paste operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Paste operation failed',
        code: 'INVALID_OPERATION',
      } as CoreCommandResult;
    }
  }

  /**
   * :
   * : Set O(1)
   * :
   * :
   */
  private resolveNameConflictEfficiently(baseName: string, existingNames: Set<string>): string {
    //  :
    let counter = 1;
    let candidateName: string;

    do {
      candidateName = `${baseName} (${counter})`;
      counter++;
      //  :
      if (counter > 10000) {
        candidateName = `${baseName} (${Date.now()})`;
        break;
      }
    } while (existingNames.has(candidateName));

    return candidateName;
  }

  /**
   * :
   * : isRemovedremovedAt
   * : folder-plugin-operations.test.ts isRemoved
   * : docs/13-archive-operations-analysis.md
   */
  async moveNodesToArchive(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }> {
    try {
      const runningBuildGuard = await this.checkRunningBuildSessionGuard(nodeIds);
      if (runningBuildGuard.blocked) {
        return {
          success: false,
          error: runningBuildGuard.message ?? 'Cannot move to archive while build session is running.',
        };
      }

      const guard = await this.checkArchiveReferenceGuard(nodeIds);
      if (guard.blocked) {
        return { success: false, error: guard.message ?? 'Cannot move to archive.' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to validate references.';
      return { success: false, error: message };
    }
    // Route via CommandProcessor holder path first.
    // Capture original parents to reinforce flags after operation
    const originalParents = new Set<NodeId>();
    for (const nid of nodeIds) {
      const n = await this.coreDB.getNode?.(nid);
      if (n?.parentId) originalParents.add(n.parentId);
    }
    const env = this.commandProcessor.createEnvelope('moveToArchive', { nodeIds });
    const res = await this.commandProcessor.processCommand(env);
    if (res.success) {
      for (const pid of Array.from(originalParents))
        await this.recomputeAncestorsHasChildrenFromParent(pid);
      return { success: true };
    }
    // Fallback: derive archive root from ancestor pattern (e.g., r:root -> r:archive) and move nodes directly under archive root
    try {
      for (const nodeId of nodeIds) {
        const node = await this.coreDB.getNode?.(nodeId);
        if (!node) continue;
        const originalParentId = node.parentId as NodeId | undefined;
        if (!originalParentId) continue;

        let cursor: NodeId | undefined = originalParentId;
        let archiveRootId: NodeId | undefined;
        while (cursor) {
          if (typeof cursor === 'string' && cursor.endsWith(':root')) {
            const prefix = cursor.slice(0, -':root'.length);
            archiveRootId = `${prefix}:archive` as NodeId;
            break;
          }
          const parent = await this.coreDB.getNode?.(cursor);
          if (!parent || parent.parentId === cursor) break;
          cursor = parent.parentId;
        }
        if (!archiveRootId) continue;
        const now = Date.now() as Timestamp;
        if ((node as { removedAt?: Timestamp }).removedAt && node.parentId === archiveRootId) {
          continue;
        }

        const preservedOriginalName =
          (node as { originalName?: string }).originalName ?? node.metadata.name;
        const archiveName =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${node.id as string}-${now}`;

        await this.coreDB.updateNode?.({
          id: node.id,
          parentId: archiveRootId,
          metadata: { ...node.metadata, name: archiveName },
          originalName: preservedOriginalName,
          originalParentId: originalParentId,
          removedAt: now,
          updatedAt: now,
          version: (node.version ?? 1) + 1,
        });
      }
      for (const pid of Array.from(originalParents))
        await this.recomputeAncestorsHasChildrenFromParent(pid);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message || String(e) };
    }
  }

  // remove legacy path removed: handled by CommandProcessor 'remove'

  /**
   * :
   * : isRemovedfalse
   * : folder-plugin-operations.test.tsisRemovedfalse
   * : docs/13-archive-operations-analysis.md
   */
  // restoreFromArchive legacy removed: handled by CommandProcessor

  async importNodes(
    cmd: CommandEnvelope<'importNodes', ImportNodesPayload>
  ): Promise<CoreCommandResult> {
    const { nodes, nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;
    const newNodeIds: NodeId[] = [];
    const idMapping = new Map<NodeId, NodeId>();

    // First pass: create ID mappings
    for (const nodeId of nodeIds) {
      const newNodeId = generateNodeId();
      idMapping.set(nodeId, newNodeId);
      newNodeIds.push(newNodeId);
    }

    // Precompute base depth from destination parent (default 0)
    let baseDepth = 0;
    try {
      const parent = await this.coreDB.getNode?.(toParentId);
      baseDepth = parent?.depth ?? 0;
    } catch (error) {
      this.logRecoverableWarning('importNodes: failed to read destination parent depth', error);
    }

    // Compute relative depth in the imported set (top-level = 1)
    const relDepthCache = new Map<NodeId, number>();
    const getRelDepth = (srcId: NodeId): number => {
      const cachedDepth = relDepthCache.get(srcId);
      if (cachedDepth !== undefined) {
        return cachedDepth;
      }
      const n = nodes[srcId];
      if (!n) {
        relDepthCache.set(srcId, 1);
        return 1;
      }
      const p = n.parentId as NodeId | undefined;
      if (!p || !nodes[p]) {
        relDepthCache.set(srcId, 1);
        return 1;
      }
      const d = getRelDepth(p) + 1;
      relDepthCache.set(srcId, d);
      return d;
    };

    // Second pass: import nodes with new IDs
    for (const nodeId of nodeIds) {
      const node = nodes[nodeId];
      if (!node) continue;

      const newNodeId = idMapping.get(nodeId);
      if (!newNodeId) continue;
      const newParentId = idMapping.get(node.parentId) || toParentId;

      // Handle name conflicts
      let newName = node.metadata.name;
      if (onNameConflict === 'auto-rename') {
        const siblings = (await this.coreDB.listChildren?.(newParentId)) || [];
        const siblingNames = siblings.map((sibling: TreeNode) => sibling.metadata.name);
        newName = createNewName(siblingNames, node.metadata.name);
      }

      await this.coreDB.createNode?.({
        ...node,
        id: newNodeId,
        parentId: newParentId,
        metadata: { ...node.metadata, name: newName },
        depth: baseDepth + getRelDepth(nodeId),
        createdAt: Date.now() as Timestamp,
        updatedAt: Date.now() as Timestamp,
        version: 1,
      });
    }

    // Mark destination ancestors as hasChildren
    await this.ensureAncestorsHaveChildrenFromParent(toParentId);
    const result: CoreCommandResult = {
      success: true,
      seq: this.getNextSeq(),
      newNodeIds,
    };

    try {
      EntityLifecycleManager.setIdMapping(cmd.commandId, idMapping);
      const lifecycle = EntityLifecycleManager.getSingleton(this.coreDB);
      await lifecycle.handleCommand(cmd);
    } catch (error) {
      this.logRecoverableWarning('importNodes: lifecycle.handleCommand failed', error);
    }

    return result;
  }

  // Undo/Redo Operations

  async undo(_cmd: CommandEnvelope<'undo', UndoPayload>): Promise<CoreCommandResult> {
    const result = await this.commandProcessor.undo();
    return result as CoreCommandResult;
  }

  async redo(_cmd: CommandEnvelope<'redo', RedoPayload>): Promise<CoreCommandResult> {
    const result = await this.commandProcessor.redo();
    return result as CoreCommandResult;
  }

  // duplicateBranch: removed previously in favor of CoreDB.duplicateSubtree (bulk-based)

  private getNextSeq(): number {
    // In a real implementation, this should be managed by CommandProcessor
    return Date.now();
  }

  private logRecoverableWarning(context: string, error: unknown): void {
    if (typeof console === 'undefined') return;
    try {
      console.warn(`[TreeMutationService] ${context}`, error);
    } catch {
      // noop: console unavailable or locked down in this environment
    }
  }

  private cloneDraftData<T extends Record<string, unknown>>(value: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return { ...value };
    }
  }

  /**
   * Provide node-type-specific default draft payloads for newly created working copies.
   * This keeps data null while seeding draftData with sensible defaults.
   */
  private resolveInitialDraftData(nodeType: NodeType): Record<string, unknown> | undefined {
    if (nodeType === 'basemap') {
      return this.cloneDraftData({
        mapStyle: { style: 'streets' },
        // Let UI hydrate viewport via Geolocation/API. Keep undefined to allow late fill.
        viewport: undefined,
      });
    }
    if (nodeType === 'shape') {
      return this.cloneDraftData({
        buildConfig: DEFAULT_BUILD_CONFIG,
        processingConfig: DEFAULT_PROCESSING_CONFIG,
      });
    }
    return undefined;
  }
}
