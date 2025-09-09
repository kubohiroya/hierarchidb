import crypto from 'crypto';
import type { CommandId, NodeId, NodeType, Seq, Timestamp, TreeNode } from '@hierarchidb/common-type';
import { commitWorkingCopyV2, createNewName } from './WorkingCopyTreeNodeOperations';
import type { CommandEnvelope, CommandEvent, CommandMeta, CommandResult } from './command-types';
import { WorkerErrorCode } from './command-types';
import type { CoreDB } from './CoreDB';
import { SingletonMixin } from '@hierarchidb/util';
import { PERFORMANCE_CONFIG } from '../utils/performance-config';
import { commandRegistry } from './command/registry';
import { validateAndNormalizeEnvelope } from './validation/envelope';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { encodeTrashHolderName } from './utils/holder-encoding';
import { hasWorkingCopyInSubtree } from './utils/policy-c';
import { EntityLifecycleManager } from '../entity/EntityLifecycleManager';
import { recordCommandLatency } from '../utils/metrics';

// Sanitized result shape used for logging only (no sensitive fields)
type SanitizedLogResult = {
  success: boolean;
  seq?: number;
  code?: string;
  error?: string;
};

export class CommandProcessor {
  static async getSingleton(coreDB: CoreDB): Promise<CommandProcessor> {
    return SingletonMixin.getSingleton(CommandProcessor.name, () => new CommandProcessor(coreDB));
  }

  // Config values for ring buffers and limits
  private readonly MAX_UNDO_STACK_SIZE = PERFORMANCE_CONFIG.MAX_UNDO_STACK_SIZE;
  private readonly MAX_REDO_STACK_SIZE = PERFORMANCE_CONFIG.MAX_REDO_STACK_SIZE;
  private readonly MAX_EVENT_HISTORY_SIZE = PERFORMANCE_CONFIG.MAX_EVENT_HISTORY_SIZE;

  // Internal state
  private undoStack: CommandEnvelope<string, unknown>[] = [];
  private redoStack: CommandEnvelope<string, unknown>[] = [];
  private eventHistory: CommandEvent[] = [];
  private sequenceNumber: number = 0;
  // Track created node ids by command for reliable undo/redo of create
  private createdNodeIdByCommand = new Map<CommandId, NodeId>();
  private preUpdateState = new Map<string, import('@hierarchidb/common-type').TreeNode>();
  private preMoveState = new Map<string, Array<import('@hierarchidb/common-type').TreeNode>>();
  private preRemoveState = new Map<string, Array<import('@hierarchidb/common-type').TreeNode>>();
  private preRecoverState = new Map<string, Array<import('@hierarchidb/common-type').TreeNode>>();

  /**
   * Create a command envelope with auto-output metadata
   */
  createEnvelope<TType extends string, TPayload>(
    type: TType,
    payload: TPayload,
    meta?: Partial<CommandMeta>,
  ): CommandEnvelope<TType, TPayload> {
    const commandId = meta?.commandId ?? (crypto.randomUUID() as CommandId);
    const timestamp = meta?.timestamp ?? (Date.now() as Timestamp);

    return {
      commandId,
      groupId: crypto.randomUUID(), // Auto-generate group ID
      kind: type,
      payload,
      issuedAt: timestamp,
      type, // Backward compatibility alias
      meta: {
        commandId,
        timestamp,
        userId: meta?.userId,
        correlationId: meta?.correlationId,
      },
    };
  }

  /**
   * Process a command safely and record to undo/redo stacks when applicable.
   */
  async processCommand<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>,
  ): Promise<CommandResult> {
    try {
      const startedAt = Date.now();
      // Validate and normalize envelope
      const checked = validateAndNormalizeEnvelope(envelope);
      if ((checked as any).ok === false) {
        return this.createErrorResult(
          (checked as ReturnType<typeof validateAndNormalizeEnvelope> & { error: string }).error,
          WorkerErrorCode.VALIDATION_ERROR,
        );
      }
      envelope = (checked as { ok: true; envelope: CommandEnvelope<TType, TPayload> }).envelope;

      // Guard against unusually long IDs
      if (envelope.commandId.length > PERFORMANCE_CONFIG.MAX_COMMAND_ID_LENGTH) {
        return this.createErrorResult(
          `Command ID too long (max ${PERFORMANCE_CONFIG.MAX_COMMAND_ID_LENGTH} chars)`,
          WorkerErrorCode.INVALID_OPERATION,
        );
      }

      // Validate that command is registered/allowed
      if (!this.isValidCommand(envelope.kind)) {
        return this.createErrorResult(
          `Invalid command type: ${envelope.kind}`,
          WorkerErrorCode.INVALID_OPERATION,
        );
      }

      // Execute via registry or fallback
      const result = await this.executeCommand(envelope);

      // Record undo (and clear redo) for undoable commands
      if (result.success && this.isUndoableCommand(envelope.kind)) {
        this.addToUndoStackSafely(envelope);
        this.clearRedoStack();
      }

      // Track event with sanitized payload
      this.recordEventSafely(envelope, result);

      const endedAt = Date.now();
      recordCommandLatency(envelope.kind, endedAt - startedAt);
      // Notify entity lifecycle (behind-the-flag). Best-effort, non-blocking in base skeleton.
      if (FEATURE_FLAGS.WORKER_ENTITY_UNIFIED && result.success) {
        try {
          const lifecycle = EntityLifecycleManager.getSingleton(this.coreDB);
          await lifecycle.handleCommand(envelope as any);
        } catch {
          // ignore lifecycle errors in base skeleton
        }
      }
      return result;
    } catch (error) {
      // Do not leak internal details in error message
      const sanitizedMessage = this.sanitizeErrorMessage(error);
      console.error('CommandProcessor error:', error);
      return this.createErrorResult(sanitizedMessage, WorkerErrorCode.INVALID_OPERATION);
    }
  }

  /**
   * Execute the actual command logic using registry when available.
   */
  private async executeCommand<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>,
  ): Promise<CommandResult> {
    if (FEATURE_FLAGS.WORKER_TX_ENABLED) {
      return await (this.coreDB as any).runInTx('rw', ['nodes'], () => this.executeCommandNoTx(envelope));
    }
    return this.executeCommandNoTx(envelope);
  }

  /**
   * Execute command logic without wrapping in a transaction.
   * Used internally and by the TX wrapper.
   */
  private async executeCommandNoTx<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>,
  ): Promise<CommandResult> {
    // Delegate to handler if present
    const handler = commandRegistry.get(envelope.kind);
    if (handler) {
      try {
        if (handler.validate) {
          const valid = await handler.validate(envelope.payload as any);
          if (!valid) {
            return this.createErrorResult('Validation failed', WorkerErrorCode.VALIDATION_ERROR);
          }
        }
        const result = await handler.execute({
          envelope,
          nextSeq: () => this.getNextSeq(),
        } as any);
        return result;
      } catch (err) {
        return this.createErrorResult(this.sanitizeErrorMessage(err), WorkerErrorCode.UNKNOWN_ERROR);
      }
    }

    // Fallback to legacy behavior (no functional change)
    switch (envelope.kind) {
      case 'createNode':
        try {
          const p = envelope.payload as unknown as {
            nodeType: NodeType;
            treeId: string;
            parentId: NodeId;
            name: string;
            description?: string;
          };
          const nodeId = (await this.coreDB.createNode({
            id: (crypto.randomUUID() as unknown) as NodeId,
            parentId: p.parentId,
            nodeType: p.nodeType,
            name: p.name,
            depth: 0,
            createdAt: (Date.now() as unknown) as Timestamp,
            updatedAt: (Date.now() as unknown) as Timestamp,
            version: 1,
            ...(p.description ? { description: p.description } : {}),
          })) as NodeId;
          // Record mapping for undo/redo
          this.createdNodeIdByCommand.set(envelope.commandId, nodeId);
          return { success: true, seq: this.getNextSeq(), nodeId };
        } catch (e) {
          return this.createErrorResult(
            e instanceof Error ? e.message : 'Create failed',
            WorkerErrorCode.DATABASE_ERROR,
          );
        }
      case 'updateNode':
        try {
          const p = envelope.payload as unknown as {
            nodeId: NodeId;
            name?: string;
            description?: string;
          };
          const node = await this.coreDB.getNode?.(p.nodeId);
          if (!node) {
            return this.createErrorResult('Node not found', WorkerErrorCode.INVALID_OPERATION);
          }
          // Save pre-state for undo
          this.preUpdateState.set(envelope.commandId, { ...node });
          await this.coreDB.updateNode?.({
            ...node,
            ...(p.name && { name: p.name }),
            ...(p.description !== undefined && { description: p.description }),
            updatedAt: (Date.now() as unknown) as Timestamp,
            version: node.version + 1,
          });
          return { success: true, seq: this.getNextSeq(), nodeId: p.nodeId };
        } catch (e) {
          return this.createErrorResult(
            e instanceof Error ? e.message : 'Update failed',
            WorkerErrorCode.DATABASE_ERROR,
          );
        }
      case 'ping':
      case 'test':
      case 'bulkCreate':
        return { success: true, seq: this.getNextSeq() };
      case 'moveNodes':
        try {
          const p = envelope.payload as unknown as {
            nodeIds: NodeId[];
            toParentId: NodeId;
            onNameConflict?: 'error' | 'auto-rename';
          };
          // parent existence check
          const parentNode = await this.coreDB.getNode?.(p.toParentId);
          if (!parentNode) {
            return this.createErrorResult('Parent node not found', WorkerErrorCode.NODE_NOT_FOUND);
          }
          // Policy C: block when subtree has working copies
          if (FEATURE_FLAGS.WORKER_POLICY_C) {
            for (const id of p.nodeIds) {
              if (await hasWorkingCopyInSubtree(this.coreDB as any, id)) {
                return this.createErrorResult('Blocked by Policy C: working copy exists in subtree', WorkerErrorCode.INVALID_OPERATION);
              }
            }
          }
          // Save pre-state for undo and prepare bulk updates
          const beforeList: TreeNode[] = [];
          const toUpdate: TreeNode[] = [];
          const siblings = (await this.coreDB.listChildren?.(p.toParentId)) || [];
          const siblingNames = new Set<string>(siblings.map((s: TreeNode) => s.name));
          for (const nodeId of p.nodeIds) {
            const node = await this.coreDB.getNode?.(nodeId);
            if (!node) continue;
            beforeList.push({ ...node });
            let newName = node.name;
            if (p.onNameConflict === 'auto-rename') {
              if (siblingNames.has(newName)) {
                const next = createNewName(Array.from(siblingNames), newName);
                newName = next;
              }
              siblingNames.add(newName);
            }
            toUpdate.push({
              ...node,
              parentId: p.toParentId,
              name: newName,
              updatedAt: (Date.now() as unknown) as Timestamp,
            } as TreeNode);
          }
          if (toUpdate.length === 1) {
            await this.coreDB.updateNode?.(toUpdate[0]);
          } else if (toUpdate.length > 1) {
            const size = PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE;
            for (let i = 0; i < toUpdate.length; i += size) {
              await (this.coreDB as any).bulkUpdateNodes?.(toUpdate.slice(i, i + size));
            }
          }
          if (beforeList.length > 0) this.preMoveState.set(envelope.commandId, beforeList);
          return { success: true, seq: this.getNextSeq() };
        } catch (e) {
          return this.createErrorResult(
            e instanceof Error ? e.message : 'Move failed',
            WorkerErrorCode.DATABASE_ERROR,
          );
        }
      case 'moveToTrash':
        try {
          const p = envelope.payload as unknown as { nodeIds: NodeId[] };
          //  Legacy path removed always use holder-based Trash

          // Holder path: create holder under trash root and move node beneath
          const trees = (await (this.coreDB.trees as any)?.toArray?.()) as
            | Array<{ rootId: NodeId; trashRootId: NodeId }>
            | undefined;
          if (!Array.isArray(trees) || trees.length === 0) {
            return this.createErrorResult('Trash roots not found', WorkerErrorCode.INVALID_OPERATION);
          }
          const rootToTrash = new Map<NodeId, NodeId>(trees.map((t) => [t.rootId, t.trashRootId]));
          for (const id of p.nodeIds) {
            const node = await this.coreDB.getNode?.(id);
            if (!node) continue;
            // ascend to find rootId
            let cursor: NodeId | undefined = node.parentId;
            let trashRootId: NodeId | undefined = undefined;
            while (cursor) {
              if (rootToTrash.has(cursor)) {
                trashRootId = rootToTrash.get(cursor)!;
                break;
              }
              const parent = await this.coreDB.getNode?.(cursor);
              if (!parent || parent.parentId === cursor) break;
              cursor = parent.parentId;
            }
            if (!trashRootId) {
              continue;
            }
            const holderId = (crypto.randomUUID() as unknown) as NodeId;
            const holderName = encodeTrashHolderName(node.parentId, node.id);
            const now = (Date.now() as unknown) as Timestamp;
            // create holder with metadata
            await this.coreDB.createNode?.({
              id: holderId,
              parentId: trashRootId,
              nodeType: ('trash' as unknown) as NodeType,
              name: holderName,
              depth: 0,
              createdAt: now,
              updatedAt: now,
              version: 1,
              holderType: 'trash' as const,
              holderTargetId: node.id,
              holderMetaParentId: node.parentId,
            } as any);
            // move node under holder
            await this.coreDB.updateNode?.({
              ...node,
              parentId: holderId,
              updatedAt: now,
              version: (node.version || 1) + 1,
            } as any);
          }
          return { success: true, seq: this.getNextSeq() };
        } catch (e) {
          return this.createErrorResult(
            e instanceof Error ? e.message : 'MoveToTrash failed',
            WorkerErrorCode.DATABASE_ERROR,
          );
        }
      case 'remove':
        try {
          const p = envelope.payload as unknown as { nodeIds: NodeId[] };
          if (FEATURE_FLAGS.WORKER_POLICY_C) {
            for (const id of p.nodeIds) {
              if (await hasWorkingCopyInSubtree(this.coreDB as any, id)) {
                return this.createErrorResult('Blocked by Policy C: working copy exists in subtree', WorkerErrorCode.INVALID_OPERATION);
              }
            }
          }
          const beforeList: TreeNode[] = [];
          for (const id of p.nodeIds) {
            const n = await this.coreDB.getNode?.(id);
            if (n) beforeList.push({ ...n });
          }
          if (p.nodeIds.length === 1) {
            await this.coreDB.deleteNode?.(p.nodeIds[0]);
          } else if (p.nodeIds.length > 1) {
            const size = PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE;
            for (let i = 0; i < p.nodeIds.length; i += size) {
              await (this.coreDB as any).bulkDeleteNodes?.(p.nodeIds.slice(i, i + size));
            }
          }
          if (beforeList.length > 0) this.preRemoveState.set(envelope.commandId, beforeList);
          return { success: true, seq: this.getNextSeq() };
        } catch (e) {
          return this.createErrorResult(
            e instanceof Error ? e.message : 'Remove failed',
            WorkerErrorCode.DATABASE_ERROR,
          );
        }
      case 'recoverFromTrash':
        try {
          const p = envelope.payload as unknown as {
            nodeIds: NodeId[];
            toParentId?: NodeId;
            onNameConflict?: 'error' | 'auto-rename';
          };
          const beforeList: TreeNode[] = [];
          const toUpdate: TreeNode[] = [];
          const holdersToDelete: NodeId[] = [];
          for (const id of p.nodeIds) {
            const node = await this.coreDB.getNode?.(id);
            if (!node) continue;
            beforeList.push({ ...node });

            let targetParentId: NodeId | undefined = p.toParentId;
            if (!targetParentId) {
              const holder = await this.coreDB.getNode?.(node.parentId);
              targetParentId = (holder as any)?.holderMetaParentId as NodeId;
            }
            targetParentId = targetParentId ?? node.parentId;
            if (!targetParentId) continue;
            let name = node.name;
            if (p.onNameConflict === 'auto-rename') {
              const siblings = (await this.coreDB.listChildren?.(targetParentId)) || [];
              const siblingNames = siblings.map((s) => s.name);
              name = createNewName(siblingNames, name);
            }
            toUpdate.push({
              ...node,
              parentId: targetParentId,
              name,
              updatedAt: (Date.now() as unknown) as Timestamp,
              version: (node.version || 1) + 1,
            } as TreeNode);
            holdersToDelete.push(node.parentId);
          }
          if (toUpdate.length === 1) {
            await this.coreDB.updateNode?.(toUpdate[0]);
          } else if (toUpdate.length > 1) {
            const size = PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE;
            for (let i = 0; i < toUpdate.length; i += size) {
              await (this.coreDB as any).bulkUpdateNodes?.(toUpdate.slice(i, i + size));
            }
          }
          if (holdersToDelete.length > 0) {
            const size = PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE;
            for (let i = 0; i < holdersToDelete.length; i += size) {
              await (this.coreDB as any).bulkDeleteNodes?.(holdersToDelete.slice(i, i + size));
            }
          }
          if (beforeList.length > 0) this.preRecoverState.set(envelope.commandId, beforeList);
          return { success: true, seq: this.getNextSeq() };
        } catch (e) {
          return this.createErrorResult(
            e instanceof Error ? e.message : 'Recover failed',
            WorkerErrorCode.DATABASE_ERROR,
          );
        }
      case 'commitWorkingCopy':
        try {
          const p = envelope.payload as unknown as {
            workingCopyId: NodeId;
            expectedUpdatedAt?: Timestamp;
            onNameConflict?: 'error' | 'auto-rename';
          };
          if (!FEATURE_FLAGS.WORKER_WC_COMMIT_V2) {
            // Legacy placeholder: treat as success without side effects
            return { success: true, seq: this.getNextSeq(), nodeId: p.workingCopyId };
          }
          const result = await commitWorkingCopyV2(this.coreDB as any, p.workingCopyId, p.onNameConflict ?? 'error');
          if (result.status === 'ok') {
            return { success: true, seq: this.getNextSeq(), nodeId: p.workingCopyId };
          }
          if (result.status === 'COMMIT_CONFLICT') {
            return this.createErrorResult(
              `Commit conflict (original=${result.originalVersion}, wc=${result.wcVersion})`,
              WorkerErrorCode.COMMIT_CONFLICT,
            );
          }
          //  NAME_CONFLICT VALIDATION_ERROR with suggestion
          return this.createErrorResult(
            `Name conflict. Suggested: ${result.suggestedName}`,
            WorkerErrorCode.VALIDATION_ERROR,
          );
        } catch (e) {
          return this.createErrorResult(
            e instanceof Error ? e.message : 'Commit failed',
            WorkerErrorCode.DATABASE_ERROR,
          );
        }
      case 'invalidCommand':
        return this.createErrorResult('Command not supported', WorkerErrorCode.INVALID_OPERATION);
      default:
        return this.createErrorResult('Command not supported', WorkerErrorCode.INVALID_OPERATION);
    }
  }

  /**
   * Check if command type is valid
   */
  private isValidCommand(type: string): boolean {
    // Registered commands are always valid
    if (commandRegistry.get(type)) return true;
    // Allow legacy commands handled by the fallback switch
    const LEGACY_SUPPORTED = new Set([
      'createNode',
      'updateNode',
      'moveNodes',
      'moveToTrash',
      'remove',
      'recoverFromTrash',
      'commitWorkingCopy',
    ]);
    return LEGACY_SUPPORTED.has(type);
  }

  /**
      * : Undo
   * :
   * :
   * : Command Pattern
      */
  private static readonly UNDOABLE_COMMANDS = new Set([
    // Mutations in current command set
    'createNode',
    'updateNode',
    'moveNodes',
    'moveToTrash',
    'remove',
    'recoverFromTrash',
    'commitWorkingCopy',
  ]);

  /**
      * : Undo
   * : SetO(1)
   * : includes()Sethas()
   * :
   * @param type
   * @returns Undo
      */
  private isUndoableCommand(type: string): boolean {
    //  : Set
    return CommandProcessor.UNDOABLE_COMMANDS.has(type);
  }

  /**
   * Get next sequence number
   */
  private getNextSeq(): Seq {
    return ++this.sequenceNumber as Seq;
  }

  /**
   * Create error result
   */
  private createErrorResult(error: string, code: WorkerErrorCode): CommandResult {
    return {
      success: false,
      error,
      code,
      seq: this.getNextSeq(),
    };
  }

  /**
   * Add to undo stack with ring buffer semantics.
   */
  private addToUndoStackSafely<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>,
  ): void {
    if (this.undoStack.length >= this.MAX_UNDO_STACK_SIZE) {
      this.undoStack.shift();
    }

    this.undoStack.push(envelope);
  }

  /**
   * Add to redo stack with ring buffer semantics.
   */
  private addToRedoStackSafely<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>,
  ): void {
    if (this.redoStack.length >= this.MAX_REDO_STACK_SIZE) {
      this.redoStack.shift();
    }

    this.redoStack.push(envelope);
  }

  /**
   * Clear redo stack.
   */
  private clearRedoStack(): void {
    this.redoStack = [];
  }

  /**
   * Record sanitized command event with ring buffer semantics.
   */
  private recordEventSafely<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>,
    result: CommandResult,
  ): void {
    if (!envelope?.commandId) {
      return;
    }

    const event: CommandEvent = {
      commandId: envelope.commandId,
      timestamp: envelope.issuedAt,
      correlationId: envelope.meta?.correlationId,
      // Store sanitized result only
      result: (this._sanitizeResultForLogging(result) as unknown) as CommandResult,
    };

    if (this.eventHistory.length >= this.MAX_EVENT_HISTORY_SIZE) {
      this.eventHistory.shift();
    }

    this.eventHistory.push(event);
  }

  /**
   * Sanitize error message for user-visible or log-safe contexts.
   */
  private sanitizeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      const sanitized = error.message
        .replace(/[\r\n\t]/g, ' ')
        .substring(0, PERFORMANCE_CONFIG.MAX_ERROR_MESSAGE_LENGTH);

      return sanitized || 'Command processing failed';
    }
    return 'An unexpected error occurred';
  }

  /**
   * Sanitize result for logging: omit sensitive fields.
   */
  private _sanitizeResultForLogging(result: CommandResult): SanitizedLogResult {
    if (result.success) {
      return {
        success: result.success,
        seq: result.seq,
      };
    } else {
      return {
        success: result.success,
        seq: result.seq ?? undefined,
        code: 'code' in result ? result.code : undefined,
        error: 'Error details omitted for security',
      };
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get undo stack size
   */
  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  /**
   * Get redo stack size
   */
  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  /**
   * Get last event
   */
  getLastEvent(): CommandEvent | undefined {
    return this.eventHistory[this.eventHistory.length - 1];
  }

  /**
      * : Undo
   * : Undo
   * : Undo
   * :
   * @returns Undo
      */
  async undo(): Promise<CommandResult> {
    //  Undo: Undo
    const command = this.undoStack.pop();
    if (!command) {
      return this.createErrorResult('No command to undo', WorkerErrorCode.INVALID_OPERATION);
    }

    try {
      //  :
      await this.executeReverseCommand(command);

      //  Ring Buffer: Redo
      this.addToRedoStackSafely(command);

      return {
        success: true,
        seq: this.getNextSeq(),
      };
    } catch (error) {
      //  : Undo
      this.undoStack.push(command);
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Undo operation failed',
        WorkerErrorCode.INVALID_OPERATION,
      );
    }
  }

  /**
      * : UndoRedo
   * : Redo
   * : Redo
   * :
   * @returns Redo
      */
  async redo(): Promise<CommandResult> {
    //  Redo: Redo
    const command = this.redoStack.pop();
    if (!command) {
      return this.createErrorResult('No command to redo', WorkerErrorCode.INVALID_OPERATION);
    }

    try {
      //  : Undo
      await this.executeRedoCommand(command);

      //  Undo: RedoUndo
      this.undoStack.push(command);

      return {
        success: true,
        seq: this.getNextSeq(),
      };
    } catch (error) {
      //  : Redo
      this.redoStack.push(command);
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Redo operation failed',
        WorkerErrorCode.INVALID_OPERATION,
      );
    }
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.eventHistory = [];
  }

  /**
      * :
   * :
   * : Undo
   * :
   * @param command
      */
  private async executeReverseCommand<TType extends string, TPayload>(
    command: CommandEnvelope<TType, TPayload>,
  ): Promise<void> {
    //  :
    switch (command.kind) {
      case 'createNode':
      case 'create': {
        // Delete the node that was created by this command
        const created = this.createdNodeIdByCommand.get(command.commandId);
        if (!created) throw new Error('No created node id recorded for create command');
        await this.coreDB.deleteNode(created);
        break;
      }

      case 'updateNode': {
        const prev = this.preUpdateState.get(command.commandId);
        if (!prev) throw new Error('No previous state recorded for updateNode');
        await this.coreDB.updateNode?.({ ...prev });
        this.preUpdateState.delete(command.commandId);
        break;
      }

      case 'moveNodes': {
        const prevList = this.preMoveState.get(command.commandId) || [];
        for (const prev of prevList) {
          await this.coreDB.updateNode?.({ ...prev });
        }
        this.preMoveState.delete(command.commandId);
        break;
      }

      case 'remove': {
        const beforeList = this.preRemoveState.get(command.commandId) || [];
        for (const n of beforeList) {
          // recreate node as best-effort
          await this.coreDB.createNode({ ...(n as any) });
        }
        this.preRemoveState.delete(command.commandId);
        break;
      }

      case 'recoverFromTrash': {
        const prevList = this.preRecoverState.get(command.commandId) || [];
        for (const prev of prevList) {
          await this.coreDB.updateNode?.({ ...prev });
        }
        this.preRecoverState.delete(command.commandId);
        break;
      }

      default:
        //  : Refactor
        throw new Error(`Reverse operation not implemented for command type: ${command.kind}`);
    }
  }

  /**
      * : Undo
   * : Redo
   * : Redo
   * :
   * @param command
      */
  private async executeRedoCommand<TType extends string, TPayload>(
    command: CommandEnvelope<TType, TPayload>,
  ): Promise<void> {
    //  :
    switch (command.kind) {
      case 'createNode':
      case 'create': {
        // Re-create the node that was created by this command
        const created = this.createdNodeIdByCommand.get(command.commandId);
        const p = (command.payload as unknown) as {
          parentId: NodeId;
          nodeType?: string;
          name: string;
          description?: string;
        };
        if (!created) throw new Error('No created node id recorded for create command');
        const restoredNode = {
          id: created,
          parentId: p.parentId,
          nodeType: (p.nodeType || 'folder') as NodeType,
          name: p.name,
          description: p.description,
          depth: 0,
          createdAt: (Date.now() as unknown) as Timestamp,
          updatedAt: (Date.now() as unknown) as Timestamp,
          version: 1,
        } as TreeNode;
        await this.coreDB.createNode(restoredNode);
        break;
      }

      case 'updateNode': {
        const p = (command.payload as unknown) as {
          nodeId: NodeId;
          name?: string;
          description?: string;
        };
        const node = await this.coreDB.getNode?.(p.nodeId);
        if (!node) throw new Error('Node not found');
        await this.coreDB.updateNode?.({
          ...node,
          ...(p.name && { name: p.name }),
          ...(p.description !== undefined && { description: p.description }),
          updatedAt: (Date.now() as unknown) as Timestamp,
          version: node.version + 1,
        });
        break;
      }

      case 'moveNodes': {
        const p = (command.payload as unknown) as {
          nodeIds: NodeId[];
          toParentId: NodeId;
          onNameConflict?: 'error' | 'auto-rename';
        };
        for (const nodeId of p.nodeIds) {
          const node = await this.coreDB.getNode?.(nodeId);
          if (!node) continue;
          let newName = node.name;
          if (p.onNameConflict === 'auto-rename') {
            const siblings = (await this.coreDB.listChildren?.(p.toParentId)) || [];
            const siblingNames = siblings.map((s: TreeNode) => s.name);
            newName = createNewName(siblingNames, node.name);
          }
          await this.coreDB.updateNode?.({
            ...node,
            parentId: p.toParentId,
            name: newName,
            updatedAt: (Date.now() as unknown) as Timestamp,
          });
        }
        break;
      }

      case 'remove': {
        const p = (command.payload as unknown) as { nodeIds: NodeId[] };
        for (const id of p.nodeIds) {
          await this.coreDB.deleteNode?.(id);
        }
        break;
      }

      case 'recoverFromTrash': {
        const p = (command.payload as unknown) as {
          nodeIds: NodeId[];
          toParentId?: NodeId;
          onNameConflict?: 'error' | 'auto-rename';
        };
        for (const id of p.nodeIds) {
          const node = await this.coreDB.getNode?.(id);
          if (!node) continue;
          const targetParentId = p.toParentId ?? node.parentId;
          if (!targetParentId) continue;
          let name = node.name;
          if (p.onNameConflict === 'auto-rename') {
            const siblings = (await this.coreDB.listChildren?.(targetParentId)) || [];
            const siblingNames = siblings.map((s) => s.name);
            name = createNewName(siblingNames, name);
          }
          await this.coreDB.updateNode?.({
            ...node,
            parentId: targetParentId,
            name,
            updatedAt: (Date.now() as unknown) as Timestamp,
            version: (node.version || 1) + 1,
          });
        }
        break;
      }

      default:
        //  : Refactor
        throw new Error(`Redo operation not implemented for command type: ${command.kind}`);
    }
  }

  /**
      * :
   * : setCoreDB
   * :
   * : any
   * : DI
      */
  constructor(private coreDB: CoreDB) {
  }
}
