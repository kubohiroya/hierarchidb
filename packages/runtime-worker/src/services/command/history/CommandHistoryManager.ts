import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { CommandId, Seq, TreeNode } from '@hierarchidb/tree-api';
import type { CoreDB } from '~/services/CoreDB';
import type {
  CommandEnvelope,
  CommandEvent,
  CommandResult,
  WorkerErrorCode,
} from '~/command-types';
import { WorkerErrorCodeValue } from '~/command-types';
import { createNewName } from '~/services/DraftTreeNodeOperations';

type SanitizedLogResult = {
  success: boolean;
  seq?: number;
  code?: string;
  error?: string;
};

/**
 * Centralizes undo/redo stacks, event history, and pre-command atoms snapshots
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
  private readonly preRestoreState = new Map<
    CommandId,
    Array<{ node: TreeNode; holder?: TreeNode; nextParentId: NodeId; nextName: string }>
  >();
  private readonly redoRestoreState = new Map<
    CommandId,
    Map<NodeId, { nextParentId: NodeId; nextName: string }>
  >();
  private readonly preMoveToArchiveState = new Map<
    CommandId,
    Array<{
      nodeId: NodeId;
      previousParentId: NodeId;
      previousName: string;
      previousOriginalName?: string;
      previousOriginalParentId?: NodeId;
      previousRemovedAt?: Timestamp;
      archiveRootId: NodeId;
      archiveRemovedAt: Timestamp;
      archiveName: string;
    }>
  >();
  private readonly preCommitDraftState = new Map<
    CommandId,
    {
      draft: TreeNode;
      committedNode?: TreeNode;
    }
  >();

  private static readonly UNDOABLE_COMMANDS = new Set([
    'createNode',
    'updateNode',
    'moveNodes',
    'moveToArchive',
    'remove',
    'restoreFromArchive',
    'commitDraft',
  ]);

  constructor(
    private readonly deps: {
      coreDB: CoreDB;
      getNextSeq: () => Seq;
      createErrorResult: (
        message: string,
        code: WorkerErrorCode,
        extra?: {
          status?: 'COMMIT_CONFLICT' | 'NAME_CONFLICT';
          suggestedName?: string;
          originalVersion?: number;
          wcVersion?: number;
        }
      ) => CommandResult;
      maxUndoStackSize: number;
      maxRedoStackSize: number;
      maxEventHistorySize: number;
    }
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
      result: this.sanitizeResultForLogging(result) as CommandResult,
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
    this.redoRestoreState.clear();
    this.preMoveToArchiveState.clear();
    this.preCommitDraftState.clear();
  }

  async undo(): Promise<CommandResult> {
    const command = this.undoStack.pop();
    if (!command) {
      return this.deps.createErrorResult(
        'No command to undo',
        WorkerErrorCodeValue.INVALID_OPERATION
      );
    }

    try {
      await this.executeReverseCommand(command);
      this.addToRedoStackSafely(command);
      return { success: true, seq: this.deps.getNextSeq() };
    } catch (error) {
      this.undoStack.push(command);
      const message = error instanceof Error ? error.message : 'Undo operation failed';
      return this.deps.createErrorResult(message, WorkerErrorCodeValue.INVALID_OPERATION);
    }
  }

  async redo(): Promise<CommandResult> {
    const command = this.redoStack.pop();
    if (!command) {
      return this.deps.createErrorResult(
        'No command to redo',
        WorkerErrorCodeValue.INVALID_OPERATION
      );
    }

    try {
      await this.executeRedoCommand(command);
      this.undoStack.push(command);
      return { success: true, seq: this.deps.getNextSeq() };
    } catch (error) {
      this.redoStack.push(command);
      const message = error instanceof Error ? error.message : 'Redo operation failed';
      return this.deps.createErrorResult(message, WorkerErrorCodeValue.INVALID_OPERATION);
    }
  }

  recordCreatedNode(commandId: CommandId, nodeId: NodeId): void {
    if (this.createdNodeIdByCommand.has(commandId)) {
      return;
    }
    this.createdNodeIdByCommand.set(commandId, nodeId);
  }

  storePreUpdateState(commandId: CommandId, node: TreeNode): void {
    if (this.preUpdateState.has(commandId)) {
      return;
    }
    this.preUpdateState.set(commandId, { ...node });
  }

  storePreMoveState(commandId: CommandId, nodes: TreeNode[]): void {
    if (this.preMoveState.has(commandId)) {
      return;
    }
    this.preMoveState.set(
      commandId,
      nodes.map((node) => ({ ...node }))
    );
  }

  storePreRemoveState(commandId: CommandId, nodes: TreeNode[]): void {
    if (this.preRemoveState.has(commandId)) {
      return;
    }
    this.preRemoveState.set(
      commandId,
      nodes.map((node) => ({ ...node }))
    );
  }

  storePreRecoverState(
    commandId: CommandId,
    entries: Array<{ node: TreeNode; holder?: TreeNode; nextParentId: NodeId; nextName: string }>
  ): void {
    if (this.preRestoreState.has(commandId)) {
      return;
    }
    this.preRestoreState.set(
      commandId,
      entries.map(({ node, holder, nextParentId, nextName }) => ({
        node: { ...node },
        holder: holder ? ({ ...holder } as TreeNode) : undefined,
        nextParentId,
        nextName,
      }))
    );
    const snapshotMap = new Map<NodeId, { nextParentId: NodeId; nextName: string }>();
    for (const entry of entries) {
      snapshotMap.set(entry.node.id as NodeId, {
        nextParentId: entry.nextParentId,
        nextName: entry.nextName,
      });
    }
    this.redoRestoreState.set(commandId, snapshotMap);
  }

  storePreMoveToArchiveState(
    commandId: CommandId,
    entries: Array<{
      nodeId: NodeId;
      previousParentId: NodeId;
      previousName: string;
      previousOriginalName?: string;
      previousOriginalParentId?: NodeId;
      previousRemovedAt?: Timestamp;
      archiveRootId: NodeId;
      archiveRemovedAt: Timestamp;
      archiveName: string;
    }>
  ): void {
    if (this.preMoveToArchiveState.has(commandId)) {
      return;
    }
    this.preMoveToArchiveState.set(
      commandId,
      entries.map((entry) => ({ ...entry }))
    );
  }

  storeCommitDraftSnapshot(
    commandId: CommandId,
    snapshot: {
      draft: TreeNode;
      committedNode?: TreeNode;
    }
  ): void {
    if (this.preCommitDraftState.has(commandId)) {
      return;
    }
    this.preCommitDraftState.set(commandId, {
      draft: { ...snapshot.draft },
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

  private async executeReverseCommand(command: CommandEnvelope<string, unknown>): Promise<void> {
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
          throw new Error('No previous atoms recorded for updateNode');
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

      case 'restoreFromArchive': {
        const commandId = command.commandId as CommandId;
        const snapshot = this.preRestoreState.get(commandId) || [];
        for (const entry of snapshot) {
          if (entry.holder) {
            await this.restoreNode(entry.holder);
          }
          await this.restoreNode(entry.node);
        }
        this.preRestoreState.delete(commandId);
        break;
      }

      case 'moveToArchive': {
        const commandId = command.commandId as CommandId;
        const entries = this.preMoveToArchiveState.get(commandId) || [];
        for (const entry of entries) {
          const node = await this.deps.coreDB.getNode?.(entry.nodeId);
          if (!node) {
            continue;
          }
          await this.deps.coreDB.updateNode?.({
            ...node,
            parentId: entry.previousParentId,
            metadata: {
              ...node.metadata,
              name: entry.previousName ?? node.metadata.name,
            },
            originalName: entry.previousOriginalName,
            originalParentId: entry.previousOriginalParentId,
            removedAt: entry.previousRemovedAt,
            updatedAt: Date.now() as Timestamp,
            version: (node.version || 1) + 1,
          });
        }
        break;
      }

      case 'commitDraft': {
        const commandId = command.commandId as CommandId;
        const snapshot = this.preCommitDraftState.get(commandId);
        if (!snapshot) {
          throw new Error('No draft snapshot recorded for undo');
        }
        if (snapshot.committedNode) {
          await this.deps.coreDB.deleteNode?.(snapshot.committedNode.id as NodeId);
        }
        await this.restoreNode(snapshot.draft);
        break;
      }

      default:
        throw new Error(`Reverse operation not implemented for command type: ${command.kind}`);
    }
  }

  private async executeRedoCommand(command: CommandEnvelope<string, unknown>): Promise<void> {
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
          metadata: { name: string; description?: string; tags?: string[] };
        };
        const restoredNode: TreeNode = {
          id: created,
          parentId: payload.parentId,
          nodeType: (payload.nodeType || 'folder') as NodeType,
          metadata: {
            name: payload.metadata.name,
            description: payload.metadata.description ?? '',
            tags: payload.metadata.tags ?? [],
          },
          draftMetadata: null,
          data: null,
          draftData: undefined,
          depth: 0,
          visible: true,
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
          metadata?: { name?: string; description?: string; tags?: string[] };
        };
        const node = await this.deps.coreDB.getNode?.(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }
        const nextMetadata =
          payload.metadata && payload.metadata.name !== undefined
            ? {
                name: payload.metadata.name,
                description:
                  payload.metadata.description !== undefined
                    ? payload.metadata.description
                    : node.metadata.description,
                tags: payload.metadata.tags ?? node.metadata.tags ?? [],
              }
            : undefined;
        await this.deps.coreDB.updateNode?.({
          ...node,
          ...(nextMetadata && { metadata: nextMetadata }),
          updatedAt: Date.now() as Timestamp,
          version: node.version + 1,
        });
        break;
      }

      case 'moveNodes': {
        const payload = command.payload as {
          nodeIds: NodeId[];
          toParentId: NodeId;
          onNameConflict?: 'error' | 'auto-rename' | 'overwrite';
        };
        for (const nodeId of payload.nodeIds) {
          const node = await this.deps.coreDB.getNode?.(nodeId);
          if (!node) {
            continue;
          }
          let nextName = node.metadata.name;
          if (payload.onNameConflict === 'auto-rename') {
            const siblings = (await this.deps.coreDB.listChildren?.(payload.toParentId)) || [];
            nextName = createNewName(
              siblings.map((sibling) => sibling.metadata.name),
              node.metadata.name
            );
          }
          await this.deps.coreDB.updateNode?.({
            ...node,
            parentId: payload.toParentId,
            metadata: { ...node.metadata, name: nextName },
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

      case 'restoreFromArchive': {
        const payload = command.payload as {
          nodeIds: NodeId[];
          toParentId?: NodeId;
          onNameConflict?: 'error' | 'auto-rename' | 'overwrite';
        };
        const commandId = command.commandId as CommandId;
        const redoSnapshot = this.redoRestoreState.get(commandId);
        for (const id of payload.nodeIds) {
          const node = await this.deps.coreDB.getNode?.(id);
          if (!node) {
            continue;
          }
          const storedNext = redoSnapshot?.get(id);
          let targetParentId = storedNext?.nextParentId ?? payload.toParentId;
          if (!targetParentId) {
            const fallbackParent = (node as { originalParentId?: NodeId }).originalParentId;
            targetParentId = fallbackParent ?? node.parentId;
          }
          if (!targetParentId) {
            continue;
          }

          const nextName =
            storedNext?.nextName ??
            (node as { originalName?: string }).originalName ??
            node.metadata.name;
          await this.deps.coreDB.updateNode?.({
            ...node,
            parentId: targetParentId,
            metadata: { ...node.metadata, name: nextName },
            originalName: undefined,
            originalParentId: undefined,
            removedAt: undefined,
            updatedAt: Date.now() as Timestamp,
            version: (node.version || 1) + 1,
          });
        }
        break;
      }

      case 'moveToArchive': {
        const commandId = command.commandId as CommandId;
        const entries = this.preMoveToArchiveState.get(commandId) || [];
        for (const entry of entries) {
          const node = await this.deps.coreDB.getNode?.(entry.nodeId);
          if (!node) {
            continue;
          }
          const now = Date.now() as Timestamp;
          const archiveName = entry.archiveName ?? node.metadata.name;
          await this.deps.coreDB.updateNode?.({
            ...node,
            parentId: entry.archiveRootId,
            metadata: { ...node.metadata, name: archiveName },
            originalName: entry.previousOriginalName ?? entry.previousName,
            originalParentId: entry.previousOriginalParentId ?? entry.previousParentId,
            removedAt: now,
            updatedAt: now,
            version: (node.version || 1) + 1,
          });
        }
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
