import type { CommandId, NodeId, Seq, Timestamp, TreeChangeEvent } from '@hierarchidb/common-types';
import { SingletonMixin, generateUUID } from '@hierarchidb/util';
import { Subject } from 'rxjs';
import { EntityLifecycleManager } from '../entity/EntityLifecycleManager.js';
import { recordCommandLatency } from '../utils/metrics.js';
import { PERFORMANCE_CONFIG } from '../utils/performance-config.js';
import type { CoreDB } from './CoreDB.js';
import { executeCoreCommand } from './command/core-handlers/index.js';
import {
  type CommandExecutionContext,
  CommandExecutionRunner,
} from './command/execution/CommandExecutionRunner.js';
import { CommandHistoryManager } from './command/history/CommandHistoryManager.js';
import { type CommandHandlerContext, commandRegistry } from './command/registry.js';
import type { CommandEnvelope, CommandEvent, CommandMeta, CommandResult } from './command-types.js';
import { WorkerErrorCode } from './command-types.js';
import { TreeSubscriptionService } from './TreeSubscriptionService.js';
import { classifyWorkerError, sanitizeMessageText } from './utils/error-adapter.js';
import { isValidationFailure, validateAndNormalizeEnvelope } from './validation/envelope.js';

type EntitiesDbTable = {
  delete(id: NodeId): Promise<void> | void;
};

type EntitiesDbAdapter = {
  table(name: string): EntitiesDbTable | undefined;
};

type EntitiesOverrideFactory =
  | EntitiesDbAdapter
  | (() => EntitiesDbAdapter | Promise<EntitiesDbAdapter | undefined> | undefined)
  | (() => Promise<EntitiesDbAdapter | undefined>);

type EntitiesOverrideRegistry = Record<string, EntitiesOverrideFactory>;

type ErrorResultExtras = {
  status?: 'COMMIT_CONFLICT' | 'NAME_CONFLICT';
  suggestedName?: string;
  originalVersion?: number;
  wcVersion?: number;
};

function getEntitiesOverrides(): EntitiesOverrideRegistry | undefined {
  const globalWithOverrides = globalThis as typeof globalThis & {
    __HDB_PLUGIN_ENTITY_OVERRIDES__?: EntitiesOverrideRegistry;
  };
  return globalWithOverrides.__HDB_PLUGIN_ENTITY_OVERRIDES__;
}

async function resolveEntitiesOverride(
  factory: EntitiesOverrideFactory | undefined
): Promise<EntitiesDbAdapter | null> {
  if (!factory) return null;
  try {
    if (typeof factory === 'function') {
      const resolved = await factory();
      return resolved ?? null;
    }
    return factory;
  } catch (error) {
    console.warn('[CommandProcessor] override resolution failed:', error);
    return null;
  }
}

export class CommandProcessor {
  static async getSingleton(coreDB: CoreDB): Promise<CommandProcessor> {
    return SingletonMixin.getSingleton(CommandProcessor.name, () => new CommandProcessor(coreDB));
  }

  // Config values for ring buffers and limits
  private readonly MAX_UNDO_STACK_SIZE = PERFORMANCE_CONFIG.MAX_UNDO_STACK_SIZE;
  private readonly MAX_REDO_STACK_SIZE = PERFORMANCE_CONFIG.MAX_REDO_STACK_SIZE;
  private readonly MAX_EVENT_HISTORY_SIZE = PERFORMANCE_CONFIG.MAX_EVENT_HISTORY_SIZE;

  // Internal state
  private readonly history: CommandHistoryManager;
  private readonly runner: CommandExecutionRunner;
  private sequenceNumber = 0;
  private undoStateServicePromise?: Promise<TreeSubscriptionService>;
  private lastUndoState = { canUndo: false, canRedo: false };

  /**
   * Create a command envelope with auto-output metadata
   */
  createEnvelope<TType extends string, TPayload>(
    type: TType,
    payload: TPayload,
    meta?: Partial<CommandMeta>
  ): CommandEnvelope<TType, TPayload> {
    const commandId = meta?.commandId ?? (generateUUID() as CommandId);
    const timestamp = meta?.timestamp ?? (Date.now() as Timestamp);

    return {
      commandId,
      groupId: generateUUID(), // Auto-generate group ID
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
    envelope: CommandEnvelope<TType, TPayload>
  ): Promise<CommandResult> {
    try {
      const startedAt = Date.now();
      // Validate and normalize envelope
      const validation = validateAndNormalizeEnvelope(envelope);
      if (isValidationFailure(validation)) {
        return this.createErrorResult(validation.error, WorkerErrorCode.VALIDATION_ERROR);
      }
      envelope = validation.envelope as CommandEnvelope<TType, TPayload>;

      // Guard against unusually long IDs
      if (envelope.commandId.length > PERFORMANCE_CONFIG.MAX_COMMAND_ID_LENGTH) {
        return this.createErrorResult(
          `Command ID too long (max ${PERFORMANCE_CONFIG.MAX_COMMAND_ID_LENGTH} chars)`,
          WorkerErrorCode.INVALID_OPERATION
        );
      }

      // Validate that command is registered/allowed
      if (!this.isValidCommand(envelope.kind)) {
        return this.createErrorResult(
          `Invalid command type: ${envelope.kind}`,
          WorkerErrorCode.INVALID_OPERATION
        );
      }

      // Execute via registry or fallback
      const result = await this.executeCommand(envelope);

      // Record undo (and clear redo) for undoable commands
      if (result.success && this.history.isUndoableCommand(envelope.kind)) {
        this.history.recordUndoableCommand(envelope as CommandEnvelope<string, unknown>);
      }

      // Track event with sanitized payload
      this.history.recordEvent(envelope as CommandEnvelope<string, unknown>, result);

      const endedAt = Date.now();
      recordCommandLatency(envelope.kind, endedAt - startedAt);
      // Notify entity lifecycle. Best-effort, non-blocking in base skeleton.
      if (result.success) {
        try {
          const lifecycle = EntityLifecycleManager.getSingleton(this.coreDB);
          await lifecycle.handleCommand(envelope as CommandEnvelope<string, unknown>);
        } catch {
          // ignore lifecycle errors in base skeleton
        }
      }

      await this.emitUndoStateIfChanged();
      return result;
    } catch (error) {
      const classification = classifyWorkerError(error, WorkerErrorCode.INVALID_OPERATION);
      console.error('CommandProcessor error:', error);
      const failure = this.createErrorResult(classification.message, classification.code);
      await this.emitUndoStateIfChanged();
      return failure;
    }
  }

  /**
   * Execute the actual command logic using registry when available.
   */
  private async executeCommand<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>
  ): Promise<CommandResult> {
    return this.runner.run(envelope, (context) => this.executeCommandNoTx(envelope, context));
  }

  /**
   * Execute command logic without wrapping in a transaction.
   * Used internally and by the TX wrapper.
   */
  private async executeCommandNoTx<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>,
    context: CommandExecutionContext
  ): Promise<CommandResult> {
    // Delegate to handler if present
    const handler = commandRegistry.get(envelope.kind);
    if (handler) {
      try {
        if (handler.validate) {
          const valid = await handler.validate(envelope.payload);
          if (!valid) {
            return this.createErrorResult('Validation failed', WorkerErrorCode.VALIDATION_ERROR);
          }
        }
        const contextForHandler: CommandHandlerContext<TType, TPayload> = {
          envelope,
          nextSeq: () => this.getNextSeq(),
        };
        return await handler.execute(contextForHandler);
      } catch (err) {
        const classification = classifyWorkerError(err, WorkerErrorCode.UNKNOWN_ERROR);
        return this.createErrorResult(classification.message, classification.code);
      }
    }

    const coreResult = await executeCoreCommand(
      envelope as CommandEnvelope<string, unknown>,
      context,
      {
        coreDB: this.coreDB,
        history: this.history,
        batchOperationSize: PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE,
        deletePeerEntitiesForNodes: (nodes) => this.deletePeerEntitiesForNodes(nodes),
        createErrorResult: (message, code, extra) => this.createErrorResult(message, code, extra),
        getNextSeq: () => this.getNextSeq(),
      }
    );

    if (coreResult) {
      return coreResult;
    }

    return this.createErrorResult('Command not supported', WorkerErrorCode.INVALID_OPERATION);
  }

  /**
   * Check if command type is valid
   */
  private isValidCommand(type: string): boolean {
    // Registered commands are always valid
    if (commandRegistry.get(type)) return true;
    // Allow core commands handled by the internal fallback handlers
    const LEGACY_SUPPORTED = new Set([
      'createNode',
      'updateNode',
      'moveNodes',
      'moveToTrash',
      'remove',
      'restoreFromTrash',
      'removeSubtree',
      'commitWorkingCopy',
    ]);
    return LEGACY_SUPPORTED.has(type);
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
  private createErrorResult(
    error: string,
    code: WorkerErrorCode,
    extra: ErrorResultExtras = {}
  ): CommandResult {
    return {
      success: false,
      error: sanitizeMessageText(error),
      code,
      seq: this.getNextSeq(),
      ...extra,
    };
  }

  private async getUndoStateService(): Promise<TreeSubscriptionService> {
    if (!this.undoStateServicePromise) {
      this.undoStateServicePromise = TreeSubscriptionService.getSingleton(this.coreDB);
    }
    return this.undoStateServicePromise;
  }

  private async emitUndoStateIfChanged(force = false): Promise<void> {
    try {
      const canUndo = this.history.canUndo();
      const canRedo = this.history.canRedo();
      if (
        !force &&
        this.lastUndoState.canUndo === canUndo &&
        this.lastUndoState.canRedo === canRedo
      ) {
        return;
      }
      this.lastUndoState = { canUndo, canRedo };
      const service = await this.getUndoStateService();
      service.publishUndoState({
        type: 'undo-state',
        canUndo,
        canRedo,
        timestamp: Date.now() as Timestamp,
      });
    } catch (error) {
      console.warn('[CommandProcessor] failed to publish undo state', error);
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.history.canUndo();
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.history.canRedo();
  }

  /**
   * Get undo stack size
   */
  getUndoStackSize(): number {
    return this.history.getUndoStackSize();
  }

  /**
   * Get redo stack size
   */
  getRedoStackSize(): number {
    return this.history.getRedoStackSize();
  }

  /**
   * Get last event
   */
  getLastEvent(): CommandEvent | undefined {
    return this.history.getLastEvent();
  }

  async undo(): Promise<CommandResult> {
    const result = await this.history.undo();
    await this.emitUndoStateIfChanged();
    return result;
  }

  async redo(): Promise<CommandResult> {
    const result = await this.history.redo();
    await this.emitUndoStateIfChanged();
    return result;
  }

  clearHistory(): void {
    this.history.clearHistory();
    void this.emitUndoStateIfChanged();
  }

  // Best-effort deletion of peerEntities (permanent delete only)
  private async deletePeerEntitiesForNodes(
    nodes: Array<import('@hierarchidb/common-types').TreeNode>
  ): Promise<void> {
    console.log('deletePeerEntitiesForNodes invoked', nodes.map((n) => [n.id, n.nodeType]));
    const { storeRegistry } = await import('../entity/store-registry.js');
    for (const n of nodes) {
      const nodeType = n.nodeType;
      const nodeId = n.id as NodeId;
      const store = storeRegistry.getPeer(nodeType);
      if (store) {
        await store.delete(nodeId);
        continue;
      }
      // Fallback: direct Dexie access when no PeerStore registered
      await this.deletePeerEntityDirect(nodeType, nodeId);
    }
  }

  private async deletePeerEntityDirect(nodeType: string, nodeId: NodeId): Promise<void> {
    const overrideFactory = getEntitiesOverrides()?.[nodeType];
    if (!overrideFactory) {
      console.warn(
        '[CommandProcessor] peer-entity cleanup skipped: no override registered for nodeType=',
        nodeType
      );
      return;
    }
    try {
      const db = await resolveEntitiesOverride(overrideFactory);
      if (db && typeof db.table === 'function') {
        const table = db.table('peerEntities');
        await table?.delete?.(nodeId);
        return;
      }
      console.warn(
        '[CommandProcessor] override provided for',
        nodeType,
        'but no table() interface found'
      );
    } catch (err) {
      console.warn('[CommandProcessor] override peer-entity cleanup failed:', err);
    }
  }

  /**
   * :
   * : setCoreDB
   * :
   * : any
   * : DI
   */
  constructor(private readonly coreDB: CoreDB) {
    const changeSubject = (coreDB as Partial<{ changeSubject?: { subscribe?: unknown } }>)
      .changeSubject as { subscribe?: unknown } | undefined;
    if (!changeSubject || typeof changeSubject.subscribe !== 'function') {
      (coreDB as unknown as { changeSubject: Subject<TreeChangeEvent> }).changeSubject =
        new Subject<TreeChangeEvent>();
    }
    this.history = new CommandHistoryManager({
      coreDB,
      getNextSeq: () => this.getNextSeq(),
      createErrorResult: (message, code, extra) => this.createErrorResult(message, code, extra),
      maxUndoStackSize: this.MAX_UNDO_STACK_SIZE,
      maxRedoStackSize: this.MAX_REDO_STACK_SIZE,
      maxEventHistorySize: this.MAX_EVENT_HISTORY_SIZE,
    });
    this.runner = new CommandExecutionRunner(coreDB);
    void this.emitUndoStateIfChanged(true);
  }
}
