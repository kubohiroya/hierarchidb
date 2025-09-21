import type {
  CommandEnvelope,
  CommandEvent,
  CommandResult,
} from '../../command-types.js';
import { WorkerErrorCode } from '../../command-types.js';
import type { CoreDB } from '../../CoreDB.js';
import { createNewName } from '../../WorkingCopyTreeNodeOperations.js';
import { encodeTrashHolderName } from '../../utils/holder-encoding.js';
import type {
  CommandId,
  NodeId,
  NodeType,
  Seq,
  Timestamp,
  TreeNode,
} from '@hierarchidb/common-type';

type SanitizedLogResult = {
  success: boolean;
  seq?: number;
  code?: string;
  error?: string;
};

/**
 * Centralizes undo/redo stacks, event history, and pre-command state snapshots
 * formerly maintained inside CommandProcessor. Responsible for replaying
 * reverse/redo operations against CoreDB while respecting configured limits.
 */
export class CommandHistoryManager {
  private readonly undoStack: CommandEnvelope<string, unknown>[] = [];
  private readonly redoStack: CommandEnvelope<string, unknown>[] = [];
  private readonly eventHistory: CommandEvent[] = [];

  private readonly createdNodeIdByCommand = new Map<CommandId, NodeId>();
  private readonly preUpdateState = new Map<CommandId, TreeNode>();
  private readonly preMoveState = new Map<CommandId, TreeNode[]>();
  private readonly preRemoveState = new Map<CommandId, TreeNode[]>();
  private readonly preRestoreState = new Map<CommandId, TreeNode[]>();
  private readonly preMoveToTrashState = new Map<CommandId, Array<{ nodeId: NodeId; previousParentId: NodeId; holderId: NodeId; trashRootId: NodeId }>>();
  private readonly preCommitWorkingCopyState = new Map<CommandId, {
    workingCopy: TreeNode;
    holder: TreeNode;
    committedNode?: TreeNode;
  }>();

  private static readonly UNDOABLE_COMMANDS = new Set([
    'createNode',
    'updateNode',
    'moveNodes',
    'moveToTrash',
    'remove',
    'restoreFromTrash',
    'commitWorkingCopy',
  ]);

  constructor(
    private readonly deps: {
      coreDB: CoreDB;
      getNextSeq: () => Seq;
      createErrorResult: (message: string, code: WorkerErrorCode) => CommandResult;
      maxUndoStackSize: number;
      maxRedoStackSize: number;
      maxEventHistorySize: number;
    },
  ) {}

  isUndoableCommand(type: string): boolean {
    return CommandHistoryManager.UNDOABLE_COMMANDS.has(type);
  }

  recordUndoableCommand(envelope: CommandEnvelope<string, unknown>): void {
    this.addToUndoStackSafely(envelope);
    this.clearRedoStack();
  }

  recordEvent(envelope: CommandEnvelope<string, unknown>, result: CommandResult): void {
    if (!envelope?.commandId) {
      return;
    }

    const event: CommandEvent = {
      commandId: envelope.commandId,
      timestamp: envelope.issuedAt,
      correlationId: envelope.meta?.correlationId,
      result: this.sanitizeResultForLogging(result) as unknown as CommandResult,
    };

    if (this.eventHistory.length >= this.deps.maxEventHistorySize) {
      this.eventHistory.shift();
    }

    this.eventHistory.push(event);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  getLastEvent(): CommandEvent | undefined {
    return this.eventHistory[this.eventHistory.length - 1];
  }

  clearHistory(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.eventHistory.length = 0;
    this.createdNodeIdByCommand.clear();
    this.preUpdateState.clear();
    this.preMoveState.clear();
    this.preRemoveState.clear();
    this.preRestoreState.clear();
    this.preMoveToTrashState.clear();
    this.preCommitWorkingCopyState.clear();
  }

  async undo(): Promise<CommandResult> {
    const command = this.undoStack.pop();
    if (!command) {
      return this.deps.createErrorResult('No command to undo', WorkerErrorCode.INVALID_OPERATION);
    }

    try {
      await this.executeReverseCommand(command);
      this.addToRedoStackSafely(command);
      return { success: true, seq: this.deps.getNextSeq() };
    } catch (error) {
      this.undoStack.push(command);
      const message = error instanceof Error ? error.message : 'Undo operation failed';
      return this.deps.createErrorResult(message, WorkerErrorCode.INVALID_OPERATION);
    }
  }

  async redo(): Promise<CommandResult> {
    const command = this.redoStack.pop();
    if (!command) {
      return this.deps.createErrorResult('No command to redo', WorkerErrorCode.INVALID_OPERATION);
    }

    try {
      await this.executeRedoCommand(command);
      this.undoStack.push(command);
      return { success: true, seq: this.deps.getNextSeq() };
    } catch (error) {
      this.redoStack.push(command);
      const message = error instanceof Error ? error.message : 'Redo operation failed';
      return this.deps.createErrorResult(message, WorkerErrorCode.INVALID_OPERATION);
    }
  }

  recordCreatedNode(commandId: CommandId, nodeId: NodeId): void {
    this.createdNodeIdByCommand.set(commandId, nodeId);
  }

  storePreUpdateState(commandId: CommandId, node: TreeNode): void {
    this.preUpdateState.set(commandId, { ...node });
  }

  storePreMoveState(commandId: CommandId, nodes: TreeNode[]): void {
    this.preMoveState.set(commandId, nodes.map((node) => ({ ...node })));
  }

  storePreRemoveState(commandId: CommandId, nodes: TreeNode[]): void {
    this.preRemoveState.set(commandId, nodes.map((node) => ({ ...node })));
  }

  storePreRecoverState(commandId: CommandId, nodes: TreeNode[]): void {
    this.preRestoreState.set(commandId, nodes.map((node) => ({ ...node })));
  }

  storePreMoveToTrashState(
    commandId: CommandId,
    entries: Array<{ nodeId: NodeId; previousParentId: NodeId; holderId: NodeId; trashRootId: NodeId }>,
  ): void {
    this.preMoveToTrashState.set(
      commandId,
      entries.map((entry) => ({ ...entry })),
    );
  }

  storeCommitWorkingCopySnapshot(
    commandId: CommandId,
    snapshot: {
      workingCopy: TreeNode;
      holder: TreeNode;
      committedNode?: TreeNode;
    },
  ): void {
    this.preCommitWorkingCopyState.set(commandId, {
      workingCopy: { ...snapshot.workingCopy },
      holder: { ...snapshot.holder },
      committedNode: snapshot.committedNode ? { ...snapshot.committedNode } : undefined,
    });
  }

  private addToUndoStackSafely(envelope: CommandEnvelope<string, unknown>): void {
    if (this.undoStack.length >= this.deps.maxUndoStackSize) {
      this.undoStack.shift();
    }
    this.undoStack.push(envelope);
  }

  private addToRedoStackSafely(envelope: CommandEnvelope<string, unknown>): void {
    if (this.redoStack.length >= this.deps.maxRedoStackSize) {
      this.redoStack.shift();
    }
    this.redoStack.push(envelope);
  }

  private clearRedoStack(): void {
    this.redoStack.length = 0;
  }

  private sanitizeResultForLogging(result: CommandResult): SanitizedLogResult {
    if (result.success) {
      return { success: true, seq: result.seq };
    }

    return {
      success: false,
      seq: result.seq,
      code: 'code' in result ? result.code : undefined,
      error: 'Error details omitted for security',
    };
  }

  private async executeReverseCommand(
    command: CommandEnvelope<string, unknown>,
  ): Promise<void> {
    switch (command.kind) {
      case 'createNode':
      case 'create': {
        const created = this.createdNodeIdByCommand.get(command.commandId);
        if (!created) {
          throw new Error('No created node id recorded for create command');
        }
        await this.deps.coreDB.deleteNode(created);
        break;
      }

      case 'updateNode': {
        const commandId = command.commandId as CommandId;
        const previous = this.preUpdateState.get(commandId);
        if (!previous) {
          throw new Error('No previous state recorded for updateNode');
        }
        await this.deps.coreDB.updateNode?.({ ...previous });
        this.preUpdateState.delete(commandId);
        break;
      }

      case 'moveNodes': {
        const commandId = command.commandId as CommandId;
        const beforeNodes = this.preMoveState.get(commandId) || [];
        for (const node of beforeNodes) {
          await this.deps.coreDB.updateNode?.({ ...node });
        }
        this.preMoveState.delete(commandId);
        break;
      }

      case 'remove': {
        const commandId = command.commandId as CommandId;
        const snapshot = this.preRemoveState.get(commandId) || [];
        for (const node of snapshot) {
          await this.deps.coreDB.createNode?.({ ...node });
        }
        this.preRemoveState.delete(commandId);
        break;
      }

      case 'restoreFromTrash': {
        const commandId = command.commandId as CommandId;
        const snapshot = this.preRestoreState.get(commandId) || [];
        for (const node of snapshot) {
          await this.deps.coreDB.updateNode?.({ ...node });
        }
        this.preRestoreState.delete(commandId);
        break;
      }

      case 'moveToTrash': {
        const commandId = command.commandId as CommandId;
        const entries = this.preMoveToTrashState.get(commandId) || [];
        for (const entry of entries) {
          const node = await this.deps.coreDB.getNode?.(entry.nodeId);
          if (!node) {
            continue;
          }
          await this.deps.coreDB.updateNode?.({
            ...node,
            parentId: entry.previousParentId,
            updatedAt: Date.now() as Timestamp,
            version: (node.version || 1) + 1,
          });
          await this.deps.coreDB.deleteNode?.(entry.holderId);
        }
        break;
      }

      case 'commitWorkingCopy': {
        const commandId = command.commandId as CommandId;
        const snapshot = this.preCommitWorkingCopyState.get(commandId);
        if (!snapshot) {
          throw new Error('No working copy snapshot recorded for undo');
        }
        if (snapshot.committedNode) {
          await this.deps.coreDB.deleteNode?.(snapshot.committedNode.id as NodeId);
        }
        await this.restoreNode(snapshot.holder);
        await this.restoreNode(snapshot.workingCopy);
        break;
      }

      default:
        throw new Error(`Reverse operation not implemented for command type: ${command.kind}`);
    }
  }

  private async executeRedoCommand(
    command: CommandEnvelope<string, unknown>,
  ): Promise<void> {
    switch (command.kind) {
      case 'createNode':
      case 'create': {
        const created = this.createdNodeIdByCommand.get(command.commandId);
        if (!created) {
          throw new Error('No created node id recorded for create command');
        }
        const payload = command.payload as {
          parentId: NodeId;
          nodeType?: NodeType;
          name: string;
          description?: string;
        };
        const restoredNode: TreeNode = {
          id: created,
          parentId: payload.parentId,
          nodeType: (payload.nodeType || 'folder') as NodeType,
          name: payload.name,
          description: payload.description,
          depth: 0,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        };
        await this.deps.coreDB.createNode(restoredNode);
        break;
      }

      case 'updateNode': {
        const payload = command.payload as {
          nodeId: NodeId;
          name?: string;
          description?: string;
        };
        const node = await this.deps.coreDB.getNode?.(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }
        await this.deps.coreDB.updateNode?.({
          ...node,
          ...(payload.name && { name: payload.name }),
          ...(payload.description !== undefined && { description: payload.description }),
          updatedAt: Date.now() as Timestamp,
          version: node.version + 1,
        });
        break;
      }

      case 'moveNodes': {
        const payload = command.payload as {
          nodeIds: NodeId[];
          toParentId: NodeId;
          onNameConflict?: 'error' | 'auto-rename';
        };
        for (const nodeId of payload.nodeIds) {
          const node = await this.deps.coreDB.getNode?.(nodeId);
          if (!node) {
            continue;
          }
          let nextName = node.name;
          if (payload.onNameConflict === 'auto-rename') {
            const siblings = (await this.deps.coreDB.listChildren?.(payload.toParentId)) || [];
            nextName = createNewName(
              siblings.map((sibling) => sibling.name),
              node.name,
            );
          }
          await this.deps.coreDB.updateNode?.({
            ...node,
            parentId: payload.toParentId,
            name: nextName,
            updatedAt: Date.now() as Timestamp,
          });
        }
        break;
      }

      case 'remove': {
        const payload = command.payload as { nodeIds: NodeId[] };
        for (const id of payload.nodeIds) {
          await this.deps.coreDB.deleteNode?.(id);
        }
        break;
      }

      case 'restoreFromTrash': {
        const payload = command.payload as {
          nodeIds: NodeId[];
          toParentId?: NodeId;
          onNameConflict?: 'error' | 'auto-rename';
        };
        for (const id of payload.nodeIds) {
          const node = await this.deps.coreDB.getNode?.(id);
          if (!node) {
            continue;
          }
          const targetParentId = payload.toParentId ?? node.parentId;
          if (!targetParentId) {
            continue;
          }
          let nextName = node.name;
          if (payload.onNameConflict === 'auto-rename') {
            const siblings = (await this.deps.coreDB.listChildren?.(targetParentId)) || [];
            nextName = createNewName(
              siblings.map((sibling) => sibling.name),
              node.name,
            );
          }
          await this.deps.coreDB.updateNode?.({
            ...node,
            parentId: targetParentId,
            name: nextName,
            updatedAt: Date.now() as Timestamp,
            version: (node.version || 1) + 1,
          });
        }
        break;
      }

      case 'moveToTrash': {
        const commandId = command.commandId as CommandId;
        const entries = this.preMoveToTrashState.get(commandId) || [];
        for (const entry of entries) {
          const node = await this.deps.coreDB.getNode?.(entry.nodeId);
          if (!node) {
            continue;
          }
          const now = Date.now() as Timestamp;
          const holderNode: TreeNode = {
            id: entry.holderId,
            parentId: entry.trashRootId,
            nodeType: 'trash' as NodeType,
            name: encodeTrashHolderName(entry.previousParentId, entry.nodeId),
            depth: 0,
            createdAt: now,
            updatedAt: now,
            version: 1,
            holderType: 'trash' as const,
            holderTargetId: entry.nodeId,
            holderMetaParentId: entry.previousParentId,
          };
          const existingHolder = await this.deps.coreDB.getNode?.(entry.holderId);
          if (!existingHolder) {
            await this.deps.coreDB.createNode?.(holderNode);
          }
          await this.deps.coreDB.updateNode?.({
            ...node,
            parentId: entry.holderId,
            updatedAt: now,
            version: (node.version || 1) + 1,
          });
        }
        break;
      }

      case 'commitWorkingCopy': {
        const commandId = command.commandId as CommandId;
        const snapshot = this.preCommitWorkingCopyState.get(commandId);
        if (!snapshot) {
          throw new Error('No working copy snapshot recorded for redo');
        }
        const holderId = snapshot.holder.id as NodeId;
        const workingCopyId = snapshot.workingCopy.id as NodeId;
        await this.restoreNode(snapshot.holder);
        await this.restoreNode(snapshot.workingCopy);
        if (snapshot.committedNode) {
          const existing = await this.deps.coreDB.getNode?.(snapshot.committedNode.id as NodeId);
          if (!existing) {
            await this.deps.coreDB.createNode?.({ ...snapshot.committedNode });
          }
        }
        await this.deps.coreDB.deleteNode?.(holderId);
        await this.deps.coreDB.deleteNode?.(workingCopyId);
        break;
      }

      default:
        throw new Error(`Redo operation not implemented for command type: ${command.kind}`);
    }
  }

  private async restoreNode(node?: TreeNode): Promise<void> {
    if (!node) return;
    const existing = await this.deps.coreDB.getNode?.(node.id as NodeId);
    if (existing) {
      await this.deps.coreDB.updateNode?.({
        ...existing,
        ...node,
      });
      return;
    }
    await this.deps.coreDB.createNode?.({ ...node });
  }
}
