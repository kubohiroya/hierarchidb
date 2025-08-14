import type { TreeMutationService } from '@hierarchidb/api';
import type {
  CommandEnvelope,
  CommandResult as CoreCommandResult,
  ErrorCode,
  CreateWorkingCopyForCreatePayload,
  CreateWorkingCopyPayload,
  DiscardWorkingCopyPayload,
  CommitWorkingCopyForCreatePayload,
  CommitWorkingCopyPayload,
  MoveNodesPayload,
  DuplicateNodesPayload,
  PasteNodesPayload,
  MoveToTrashPayload,
  PermanentDeletePayload,
  RecoverFromTrashPayload,
  ImportNodesPayload,
  UndoPayload,
  RedoPayload,
  TreeNodeId,
  TreeNode,
  UUID,
  Timestamp,
} from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';
import type { CommandResult } from '../command/types';
import { CoreDB } from '../db/CoreDB';
import { EphemeralDB } from '../db/EphemeralDB';
import { CommandProcessor } from '../command/CommandProcessor';
import { NodeLifecycleManager } from '../lifecycle/NodeLifecycleManager';
import {
  createNewDraftWorkingCopy,
  createWorkingCopyFromNode,
  commitWorkingCopy,
  createNewName,
} from '../operations/WorkingCopyOperations';

export class TreeMutationServiceImpl implements TreeMutationService {
  constructor(
    private coreDB: CoreDB,
    private ephemeralDB: EphemeralDB,
    private commandProcessor: CommandProcessor,
    private lifecycleManager: NodeLifecycleManager
  ) {}

  // Working Copy Operations

  async createWorkingCopyForCreate(
    cmd: CommandEnvelope<'createWorkingCopyForCreate', CreateWorkingCopyForCreatePayload>
  ): Promise<void> {
    const { workingCopyId, parentTreeNodeId, name, description } = cmd.payload;

    // Create draft working copy
    await createNewDraftWorkingCopy(
      this.ephemeralDB,
      this.coreDB,
      parentTreeNodeId,
      'folder', // Default type, should be passed in payload
      name
    );

    // If description provided, update the working copy
    if (description) {
      const wc = await this.ephemeralDB.getWorkingCopy?.(workingCopyId);
      if (wc) {
        wc.description = description;
        await this.ephemeralDB.updateWorkingCopy?.(wc);
      }
    }
  }

  async createWorkingCopy(
    cmd: CommandEnvelope<'createWorkingCopy', CreateWorkingCopyPayload>
  ): Promise<void> {
    const { sourceTreeNodeId } = cmd.payload;

    // Check if source node exists
    const sourceNode = await this.coreDB.getNode?.(sourceTreeNodeId);
    if (!sourceNode) {
      throw new Error('Node not found');
    }

    await createWorkingCopyFromNode(this.ephemeralDB, this.coreDB, sourceTreeNodeId);
  }

  async discardWorkingCopyForCreate(
    cmd: CommandEnvelope<'discardWorkingCopyForCreate', DiscardWorkingCopyPayload>
  ): Promise<void> {
    const { workingCopyId } = cmd.payload;
    await this.ephemeralDB.deleteWorkingCopy?.(workingCopyId);
  }

  async discardWorkingCopy(
    cmd: CommandEnvelope<'discardWorkingCopy', DiscardWorkingCopyPayload>
  ): Promise<void> {
    const { workingCopyId } = cmd.payload;
    await this.ephemeralDB.deleteWorkingCopy?.(workingCopyId);
  }

  async commitWorkingCopyForCreate(
    cmd: CommandEnvelope<'commitWorkingCopyForCreate', CommitWorkingCopyForCreatePayload>
  ): Promise<CoreCommandResult> {
    const { workingCopyId, onNameConflict = 'error' } = cmd.payload;

    const result = await commitWorkingCopy(
      this.ephemeralDB,
      this.coreDB,
      workingCopyId,
      true, // isDraft
      onNameConflict
    );

    // Convert worker CommandResult to CoreCommandResult
    return result as CoreCommandResult;
  }

  async commitWorkingCopy(
    cmd: CommandEnvelope<'commitWorkingCopy', CommitWorkingCopyPayload>
  ): Promise<CoreCommandResult> {
    const { workingCopyId, onNameConflict = 'error' } = cmd.payload;

    const result = await commitWorkingCopy(
      this.ephemeralDB,
      this.coreDB,
      workingCopyId,
      false, // not a draft
      onNameConflict
    );

    // Convert worker CommandResult to CoreCommandResult
    return result as CoreCommandResult;
  }

  // Physical Operations

  async moveNodes(cmd: CommandEnvelope<'moveNodes', MoveNodesPayload>): Promise<CoreCommandResult> {
    const { nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;

    // Check for circular reference
    for (const nodeId of nodeIds) {
      if (await this.isDescendantOf(toParentId, nodeId)) {
        return {
          success: false,
          error: 'Circular reference detected',
          code: 'ILLEGAL_RELATION',
        } as CoreCommandResult;
      }
    }

    // Move each node
    for (const nodeId of nodeIds) {
      const node = await this.coreDB.getNode?.(nodeId);
      if (!node) continue;

      // Handle name conflicts
      let newName = node.name;
      if (onNameConflict === 'auto-rename') {
        const siblings = (await this.coreDB.getChildren?.(toParentId)) || [];
        const siblingNames = siblings.map((s: any) => s.name);
        newName = createNewName(siblingNames, node.name);
      }

      await this.coreDB.updateNode?.({
        ...node,
        parentTreeNodeId: toParentId,
        name: newName,
        updatedAt: Date.now() as Timestamp,
      });
    }

    return {
      success: true,
      seq: this.getNextSeq(),
    } as CoreCommandResult;
  }

  async duplicateNodes(
    cmd: CommandEnvelope<'duplicateNodes', DuplicateNodesPayload>
  ): Promise<CoreCommandResult> {
    const { nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;
    const newNodeIds: TreeNodeId[] = [];

    for (const sourceId of nodeIds) {
      const sourceNode = await this.coreDB.getNode?.(sourceId);
      if (!sourceNode) continue;

      // Duplicate node and descendants
      const idMapping = new Map<TreeNodeId, TreeNodeId>();
      await this.duplicateBranch(sourceId, toParentId, idMapping, true);

      newNodeIds.push(...Array.from(idMapping.values()));
    }

    return {
      success: true,
      seq: this.getNextSeq(),
      newNodeIds,
    };
  }

  async pasteNodes(
    cmd: CommandEnvelope<'pasteNodes', PasteNodesPayload>
  ): Promise<CoreCommandResult> {
    const { nodes, nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;
    const newNodeIds: TreeNodeId[] = [];

    for (const nodeId of nodeIds) {
      const node = nodes[nodeId];
      if (!node) continue;

      const newNodeId = generateUUID() as TreeNodeId;

      // Handle name conflicts
      let newName = node.name;
      if (onNameConflict === 'auto-rename') {
        const siblings = (await this.coreDB.getChildren?.(toParentId)) || [];
        const siblingNames = siblings.map((s: any) => s.name);
        newName = createNewName(siblingNames, node.name);
      }

      await this.coreDB.createNode?.({
        ...node,
        treeNodeId: newNodeId,
        parentTreeNodeId: toParentId,
        name: newName,
        createdAt: Date.now() as Timestamp,
        updatedAt: Date.now() as Timestamp,
        version: 1,
      });

      newNodeIds.push(newNodeId);
    }

    return {
      success: true,
      seq: this.getNextSeq(),
      newNodeIds,
    };
  }

  async moveToTrash(
    cmd: CommandEnvelope<'moveToTrash', MoveToTrashPayload>
  ): Promise<CoreCommandResult> {
    const { nodeIds } = cmd.payload;
    const trashRootId = 'trash' as TreeNodeId; // Should come from configuration

    for (const nodeId of nodeIds) {
      const node = await this.coreDB.getNode?.(nodeId);
      if (!node) continue;

      // Move to trash and save original info
      const updateData: Partial<TreeNode> = {
        parentTreeNodeId: trashRootId,
        originalParentTreeNodeId: node.parentTreeNodeId,
        originalName: node.name,
        removedAt: Date.now() as Timestamp,
        updatedAt: Date.now() as Timestamp,
      };
      await this.coreDB.updateNode?.({
        ...node,
        ...updateData,
      });
    }

    return {
      success: true,
      seq: this.getNextSeq(),
    } as CoreCommandResult;
  }

  async permanentDelete(
    cmd: CommandEnvelope<'permanentDelete', PermanentDeletePayload>
  ): Promise<CoreCommandResult> {
    const { nodeIds } = cmd.payload;

    for (const nodeId of nodeIds) {
      // Delete node and all descendants recursively
      await this.deleteNodeRecursively(nodeId);
    }

    return {
      success: true,
      seq: this.getNextSeq(),
    } as CoreCommandResult;
  }

  async recoverFromTrash(
    cmd: CommandEnvelope<'recoverFromTrash', RecoverFromTrashPayload>
  ): Promise<CoreCommandResult> {
    const { nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;

    for (const nodeId of nodeIds) {
      const node = await this.coreDB.getNode?.(nodeId);
      if (!node) continue;

      const targetParentId = toParentId || node.originalParentTreeNodeId;
      if (!targetParentId) continue;

      // Handle name conflicts
      let restoredName = node.originalName || node.name;
      if (onNameConflict === 'auto-rename') {
        const siblings = (await this.coreDB.getChildren?.(targetParentId)) || [];
        const siblingNames = siblings.map((s: any) => s.name);
        restoredName = createNewName(siblingNames, restoredName);
      }

      // Restore node
      const restoreData: Partial<TreeNode> = {
        parentTreeNodeId: targetParentId,
        name: restoredName,
        originalParentTreeNodeId: undefined,
        originalName: undefined,
        removedAt: undefined,
        updatedAt: Date.now() as Timestamp,
      };
      await this.coreDB.updateNode?.({
        ...node,
        ...restoreData,
      });
    }

    return {
      success: true,
      seq: this.getNextSeq(),
    } as CoreCommandResult;
  }

  async importNodes(
    cmd: CommandEnvelope<'importNodes', ImportNodesPayload>
  ): Promise<CoreCommandResult> {
    const { nodes, nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;
    const newNodeIds: TreeNodeId[] = [];
    const idMapping = new Map<TreeNodeId, TreeNodeId>();

    // First pass: create ID mappings
    for (const nodeId of nodeIds) {
      const newNodeId = generateUUID() as TreeNodeId;
      idMapping.set(nodeId, newNodeId);
      newNodeIds.push(newNodeId);
    }

    // Second pass: import nodes with new IDs
    for (const nodeId of nodeIds) {
      const node = nodes[nodeId];
      if (!node) continue;

      const newNodeId = idMapping.get(nodeId)!;
      const newParentId = idMapping.get(node.parentTreeNodeId) || toParentId;

      // Handle name conflicts
      let newName = node.name;
      if (onNameConflict === 'auto-rename') {
        const siblings = (await this.coreDB.getChildren?.(newParentId)) || [];
        const siblingNames = siblings.map((s: any) => s.name);
        newName = createNewName(siblingNames, node.name);
      }

      await this.coreDB.createNode?.({
        ...node,
        treeNodeId: newNodeId,
        parentTreeNodeId: newParentId,
        name: newName,
        createdAt: Date.now() as Timestamp,
        updatedAt: Date.now() as Timestamp,
        version: 1,
      });
    }

    return {
      success: true,
      seq: this.getNextSeq(),
      newNodeIds,
    };
  }

  // Undo/Redo Operations

  async undo(cmd: CommandEnvelope<'undo', UndoPayload>): Promise<CoreCommandResult> {
    const { groupId } = cmd.payload;
    const result = await (this.commandProcessor as any).undo(groupId);
    return result as CoreCommandResult;
  }

  async redo(cmd: CommandEnvelope<'redo', RedoPayload>): Promise<CoreCommandResult> {
    const { groupId } = cmd.payload;
    const result = await (this.commandProcessor as any).redo(groupId);
    return result as CoreCommandResult;
  }

  // Helper methods

  private async isDescendantOf(nodeId: TreeNodeId, ancestorId: TreeNodeId): Promise<boolean> {
    let currentId = nodeId;
    const visited = new Set<TreeNodeId>();

    while (currentId && currentId !== ('root' as TreeNodeId)) {
      if (visited.has(currentId)) {
        return false; // Circular reference protection
      }
      visited.add(currentId);

      if (currentId === ancestorId) {
        return true;
      }

      const node = await this.coreDB.getNode?.(currentId);
      if (!node) break;

      currentId = node.parentTreeNodeId;
    }

    return false;
  }

  private async duplicateBranch(
    sourceId: TreeNodeId,
    targetParentId: TreeNodeId,
    idMapping: Map<TreeNodeId, TreeNodeId>,
    isRoot: boolean
  ): Promise<void> {
    const sourceNode = await this.coreDB.getNode?.(sourceId);
    if (!sourceNode) return;

    const newNodeId = generateUUID() as TreeNodeId;
    idMapping.set(sourceId, newNodeId);

    // Create duplicated node
    await this.coreDB.createNode?.({
      ...sourceNode,
      treeNodeId: newNodeId,
      parentTreeNodeId: targetParentId,
      name: isRoot ? `${sourceNode.name} (Copy)` : sourceNode.name,
      createdAt: Date.now() as Timestamp,
      updatedAt: Date.now() as Timestamp,
      version: 1,
    });

    // Duplicate children
    const children = (await this.coreDB.getChildren?.(sourceId)) || [];
    for (const child of children) {
      await this.duplicateBranch(child.treeNodeId, newNodeId, idMapping, false);
    }
  }

  private async deleteNodeRecursively(nodeId: TreeNodeId): Promise<void> {
    // Delete children first
    const children = (await this.coreDB.getChildren?.(nodeId)) || [];
    for (const child of children) {
      await this.deleteNodeRecursively(child.treeNodeId);
    }

    // Delete the node itself
    await this.coreDB.deleteNode?.(nodeId);
  }

  private getNextSeq(): number {
    // In a real implementation, this should be managed by CommandProcessor
    return Date.now();
  }
}
