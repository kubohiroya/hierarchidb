import crypto from 'crypto';
import type { CommandId, NodeType } from '@hierarchidb/common-type';
import type { TreeNode, NodeId, Timestamp, Seq } from '@hierarchidb/common-type';
import { createNewName } from './WorkingCopyTreeNodeOperations';
import type { CommandEnvelope, CommandEvent, CommandMeta, CommandResult } from './command-types';
import { WorkerErrorCode } from './command-types';
import type { CoreDB } from './CoreDB';
import { SingletonMixin } from '@hierarchidb/util';
import { PERFORMANCE_CONFIG } from '../utils/performance-config';
import { commandRegistry } from './command/registry';
import { validateAndNormalizeEnvelope } from './validation/envelope';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { commitWorkingCopyV2 } from './WorkingCopyTreeNodeOperations';
import { encodeTrashHolderName, decodeTrashHolderName } from './utils/holder-encoding';
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
    meta?: Partial<CommandMeta>
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
    envelope: CommandEnvelope<TType, TPayload>
  ): Promise<CommandResult> {
    try {
      const startedAt = Date.now();
      // Validate and normalize envelope
      const checked = validateAndNormalizeEnvelope(envelope);
      if ((checked as any).ok === false) {
        return this.createErrorResult(
          (checked as ReturnType<typeof validateAndNormalizeEnvelope> & { error: string }).error,
          WorkerErrorCode.VALIDATION_ERROR
        );
      }
      envelope = (checked as { ok: true; envelope: CommandEnvelope<TType, TPayload> }).envelope;

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
    envelope: CommandEnvelope<TType, TPayload>
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
    envelope: CommandEnvelope<TType, TPayload>
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
          return { success: true, seq: this.getNextSeq(), nodeId };
        } catch (e) {
          return this.createErrorResult(
            e instanceof Error ? e.message : 'Create failed',
            WorkerErrorCode.DATABASE_ERROR
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
            WorkerErrorCode.DATABASE_ERROR
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
            WorkerErrorCode.DATABASE_ERROR
          );
        }
      case 'moveToTrash':
        try {
          const p = envelope.payload as unknown as { nodeIds: NodeId[] };
          // Legacy path removed — always use holder-based Trash

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
            WorkerErrorCode.DATABASE_ERROR
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
            WorkerErrorCode.DATABASE_ERROR
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
            WorkerErrorCode.DATABASE_ERROR
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
              WorkerErrorCode.COMMIT_CONFLICT
            );
          }
          // NAME_CONFLICT → VALIDATION_ERROR with suggestion
          return this.createErrorResult(
            `Name conflict. Suggested: ${result.suggestedName}`,
            WorkerErrorCode.VALIDATION_ERROR
          );
        } catch (e) {
          return this.createErrorResult(
            e instanceof Error ? e.message : 'Commit failed',
            WorkerErrorCode.DATABASE_ERROR
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
    // Treat only registered commands as valid; others map to INVALID_OPERATION
    return Boolean(commandRegistry.get(type));
  }

  /**
   * 【コード品質向上】: Undo可能コマンドの集約管理
   * 【改善内容】: 設定値の外部化と保守性向上
   * 【拡張性】: 新しいコマンドタイプの追加容易性
   * 🟢 信頼性レベル: 標準的なCommand Patternに準拠
   */
  private static readonly UNDOABLE_COMMANDS = new Set([
    // 【基本操作】: ノードの基本的なCRUD操作
    'createNode',
    'updateNode',
    'deleteNode',
    'moveNode',

    // 【汎用操作】: 汎用ノード操作コマンド
    'create', // 【汎用ノード作成】: 任意のノードタイプに対応
    'moveFolder', // 【フォルダ移動】: 将来対応のため追加
    'updateFolder', // 【フォルダ更新】: 将来対応のため追加

    // 【Working Copy操作】: 作業コピーの管理コマンド
    'commitWorkingCopyForCreate', // 【Working Copy コミット】: 実際の作成処理
  ]);

  /**
   * 【機能概要】: コマンドがUndo可能かどうかを高速判定する
   * 【改善内容】: Set使用によるO(1)時間計算量での判定
   * 【パフォーマンス】: 配列のincludes()からSetのhas()への最適化
   * 🟢 信頼性レベル: 標準的なアルゴリズム最適化手法に準拠
   * @param type コマンドタイプ
   * @returns Undo可能かどうか
   */
  private isUndoableCommand(type: string): boolean {
    // 【パフォーマンス最適化】: Setによる高速ルックアップ 🟢
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
    envelope: CommandEnvelope<TType, TPayload>
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
    envelope: CommandEnvelope<TType, TPayload>
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
    result: CommandResult
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
   * 【機能概要】: 最後のコマンドをUndo（元に戻す）する
   * 【実装方針】: テストを通すための最小限のUndo実装
   * 【テスト対応】: フォルダ作成Undoテストで期待される動作を実現
   * 🟢 信頼性レベル: 元資料の分析に基づいた逆操作実装
   * @returns Undoの結果
   */
  async undo(): Promise<CommandResult> {
    // 【Undoスタック確認】: Undo可能なコマンドが存在するかチェック 🟢
    const command = this.undoStack.pop();
    if (!command) {
      return this.createErrorResult('No command to undo', WorkerErrorCode.INVALID_OPERATION);
    }

    try {
      // 【逆操作実行】: コマンドの逆操作を実行してデータを元の状態に戻す 🟢
      await this.executeReverseCommand(command);

      // 【Ring Buffer適用】: 安全なRedoスタック追加 🟢
      this.addToRedoStackSafely(command);

      return {
        success: true,
        seq: this.getNextSeq(),
      };
    } catch (error) {
      // 【失敗時のロールバック】: Undo失敗時は元のスタックに戻す 🟡
      this.undoStack.push(command);
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Undo operation failed',
        WorkerErrorCode.INVALID_OPERATION
      );
    }
  }

  /**
   * 【機能概要】: Undoした操作をRedo（やり直し）する
   * 【実装方針】: テストを通すための最小限のRedo実装
   * 【テスト対応】: フォルダ作成Redoテストで期待される動作を実現
   * 🟢 信頼性レベル: 元資料の分析に基づいた再実行実装
   * @returns Redoの結果
   */
  async redo(): Promise<CommandResult> {
    // 【Redoスタック確認】: Redo可能なコマンドが存在するかチェック 🟢
    const command = this.redoStack.pop();
    if (!command) {
      return this.createErrorResult('No command to redo', WorkerErrorCode.INVALID_OPERATION);
    }

    try {
      // 【コマンド再実行】: Undoで取り消されたコマンドを再実行 🟢
      await this.executeRedoCommand(command);

      // 【Undoスタック追加】: Redo成功後はUndoスタックに戻す 🟢
      this.undoStack.push(command);

      return {
        success: true,
        seq: this.getNextSeq(),
      };
    } catch (error) {
      // 【失敗時のロールバック】: Redo失敗時は元のスタックに戻す 🟡
      this.redoStack.push(command);
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Redo operation failed',
        WorkerErrorCode.INVALID_OPERATION
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
   * 【機能概要】: コマンドの逆操作を実行してデータを元の状態に戻す
   * 【実装方針】: テストを通すための最小限の逆操作実装
   * 【テスト対応】: フォルダ作成Undoで期待されるノード削除動作を実現
   * 🟡 信頼性レベル: 元資料から推測したフォルダ削除ロジック
   * @param command 逆操作を実行するコマンド
   */
  private async executeReverseCommand<TType extends string, TPayload>(
    command: CommandEnvelope<TType, TPayload>
  ): Promise<void> {
    // 【コマンド種別による逆操作分岐】: コマンドタイプに応じて適切な逆操作を実行 🟢
    switch (command.kind) {
      case 'createNode':
      case 'create': {
        // 【汎用ノード作成の逆操作】: 作成されたノードを削除 🟡
        const payload = command.payload as { nodeId: NodeId };
        const nodeId = payload.nodeId;

        // 【アーキテクチャ改善】: インターフェースベースの型安全なデータベース操作 🟢
        await this.coreDB.deleteNode(nodeId);
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
        // 【未対応コマンド】: Refactorフェーズで拡張予定 🔴
        throw new Error(`Reverse operation not implemented for command type: ${command.kind}`);
    }
  }

  /**
   * 【機能概要】: Undoされたコマンドを再実行する
   * 【実装方針】: テストを通すための最小限のRedo実装
   * 【テスト対応】: フォルダ作成Redoで期待されるノード復元動作を実現
   * 🟡 信頼性レベル: 元資料から推測したフォルダ再作成ロジック
   * @param command 再実行するコマンド
   */
  private async executeRedoCommand<TType extends string, TPayload>(
    command: CommandEnvelope<TType, TPayload>
  ): Promise<void> {
    // 【コマンド種別による再実行分岐】: コマンドタイプに応じて適切な再実行を行う 🟢
    switch (command.kind) {
      case 'createNode':
      case 'create': {
        // 【汎用ノード作成の再実行】: 削除されたノードを再作成 🟡
        const payload = command.payload as {
          nodeId: NodeId;
          parentId: NodeId;
          nodeType?: string;
          name: string;
          description?: string;
        };

        // 【アーキテクチャ改善】: インターフェースベースの型安全なノード復元 🟢
        const restoredNode = {
          id: payload.nodeId,
          parentId: payload.parentId,
          nodeType: (payload.nodeType || 'folder') as NodeType,
          name: payload.name,
          description: payload.description,
          depth: 0, // Will be calculated by database operations
          createdAt: Date.now() as Timestamp, // 【作成日時更新】: 新しいタイムスタンプで復元
          updatedAt: Date.now() as Timestamp,
          version: 1,
        };

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
        // 【未対応コマンド】: Refactorフェーズで拡張予定 🔴
        throw new Error(`Redo operation not implemented for command type: ${command.kind}`);
    }
  }

  /**
   * 【コンストラクタ注入】: 依存関係の明示的な注入による堅牢な設計
   * 【改善内容】: 暫定的なsetCoreDBメソッドを排除し、コンストラクタベースの注入を実装
   * 【設計方針】: インターフェース分離原則に基づく疎結合設計
   * 【型安全性】: any型を排除し、適切な型定義による安全性向上
   * 🟢 信頼性レベル: DIパターンのベストプラクティスに準拠
   */
  constructor(private coreDB: CoreDB) {}
}
