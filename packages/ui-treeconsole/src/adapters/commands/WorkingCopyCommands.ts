/**
 * WorkingCopyCommands Adapter
 * 
 * 既存TreeConsoleのWorking Copy操作を新しいWorkerAPIのCommandEnvelope形式に変換します。
 * ノードの編集開始、変更の保存、破棄などのWorking Copyパターンを提供します。
 */

import type { WorkerAPI } from '@hierarchidb/api';
import type {
  TreeNodeId,
  TreeNode,
  UUID,

  Timestamp,
  CreateWorkingCopyPayload,
  CreateWorkingCopyForCreatePayload,
  CommitWorkingCopyPayload,
  CommitWorkingCopyForCreatePayload,
  DiscardWorkingCopyPayload
} from '@hierarchidb/core';
import { createCommand, createAdapterCommandId } from '../utils';
import type { CommandAdapterOptions } from '../types';
import { TreeConsoleAdapterError } from '../types';

export interface WorkingCopyEditSession {
  workingCopyId: UUID;
  sourceNodeId?: TreeNodeId;
  parentNodeId?: TreeNodeId;
  isCreate: boolean;
  expectedUpdatedAt?: Timestamp;
}

export class WorkingCopyCommandsAdapter {
  constructor(private workerAPI: WorkerAPI) {}

  /**
   * 既存ノード編集のためのWorking Copy作成
   * 
   * @param sourceNodeId 編集対象のノードID
   * @param options アダプター実行オプション
   * @returns 編集セッション情報
   */
  async startNodeEdit(
    sourceNodeId: TreeNodeId,
    options: CommandAdapterOptions
  ): Promise<WorkingCopyEditSession> {
    try {
      const workingCopyId = createAdapterCommandId();
      
      const command = createCommand('createWorkingCopy', {
        workingCopyId,
        sourceTreeNodeId: sourceNodeId
      } as CreateWorkingCopyPayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      await this.workerAPI.createWorkingCopy(command);
      
      // 現在のノードデータを取得（expectedUpdatedAtの設定用）
      const currentNodeData = await this.getCurrentNodeData(sourceNodeId);
      
      return {
        workingCopyId,
        sourceNodeId,
        isCreate: false,
        expectedUpdatedAt: currentNodeData?.updatedAt
      };
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to start editing node ${sourceNodeId}`,
        'START_NODE_EDIT_ERROR',
        error as Error
      );
    }
  }

  /**
   * 新規ノード作成のためのWorking Copy作成
   * 
   * @param parentNodeId 新規ノードの親ノードID
   * @param name 新規ノードの名前
   * @param description 新規ノードの説明（省略可能）
   * @param options アダプター実行オプション
   * @returns 編集セッション情報
   */
  async startNodeCreate(
    parentNodeId: TreeNodeId,
    name: string,
    description: string | undefined,
    options: CommandAdapterOptions
  ): Promise<WorkingCopyEditSession> {
    try {
      const workingCopyId = createAdapterCommandId();
      
      const command = createCommand('createWorkingCopyForCreate', {
        workingCopyId,
        parentTreeNodeId: parentNodeId,
        name,
        description
      } as CreateWorkingCopyForCreatePayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      await this.workerAPI.createWorkingCopyForCreate(command);
      
      return {
        workingCopyId,
        parentNodeId,
        isCreate: true
      };
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to start creating node in parent ${parentNodeId}`,
        'START_NODE_CREATE_ERROR',
        error as Error
      );
    }
  }

  /**
   * Working Copyの変更を保存（既存ノード編集）
   * 
   * @param editSession 編集セッション情報
   * @param options アダプター実行オプション
   * @returns Promise<void>
   */
  async commitNodeEdit(
    editSession: WorkingCopyEditSession,
    options: CommandAdapterOptions
  ): Promise<void> {
    if (editSession.isCreate) {
      throw new TreeConsoleAdapterError(
        'Use commitNodeCreate for new node creation',
        'INVALID_COMMIT_OPERATION'
      );
    }

    try {
      const command = createCommand('commitWorkingCopy', {
        workingCopyId: editSession.workingCopyId,
        expectedUpdatedAt: editSession.expectedUpdatedAt!,
        onNameConflict: options.context.onNameConflict
      } as CommitWorkingCopyPayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      const result = await this.workerAPI.commitWorkingCopy(command);
      
      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to commit node edit: ${result.error || 'Unknown error'}`,
          result.code || 'COMMIT_NODE_EDIT_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Commit edit operation failed for working copy ${editSession.workingCopyId}`,
        'COMMIT_NODE_EDIT_ADAPTER_ERROR',
        error as Error
      );
    }
  }

  /**
   * Working Copyの変更を保存（新規ノード作成）
   * 
   * @param editSession 編集セッション情報
   * @param options アダプター実行オプション
   * @returns Promise<void>
   */
  async commitNodeCreate(
    editSession: WorkingCopyEditSession,
    options: CommandAdapterOptions
  ): Promise<void> {
    if (!editSession.isCreate) {
      throw new TreeConsoleAdapterError(
        'Use commitNodeEdit for existing node editing',
        'INVALID_COMMIT_OPERATION'
      );
    }

    try {
      const command = createCommand('commitWorkingCopyForCreate', {
        workingCopyId: editSession.workingCopyId,
        onNameConflict: options.context.onNameConflict
      } as CommitWorkingCopyForCreatePayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      const result = await this.workerAPI.commitWorkingCopyForCreate(command);
      
      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to commit node create: ${result.error || 'Unknown error'}`,
          result.code || 'COMMIT_NODE_CREATE_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Commit create operation failed for working copy ${editSession.workingCopyId}`,
        'COMMIT_NODE_CREATE_ADAPTER_ERROR',
        error as Error
      );
    }
  }

  /**
   * Working Copyの変更を破棄
   * 
   * @param editSession 編集セッション情報
   * @param options アダプター実行オプション
   * @returns Promise<void>
   */
  async discardChanges(
    editSession: WorkingCopyEditSession,
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const commandKind = editSession.isCreate ? 'discardWorkingCopyForCreate' : 'discardWorkingCopy';
      
      const command = createCommand(commandKind, {
        workingCopyId: editSession.workingCopyId
      } as DiscardWorkingCopyPayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      if (editSession.isCreate) {
        await this.workerAPI.discardWorkingCopyForCreate(command as any);
      } else {
        await this.workerAPI.discardWorkingCopy(command as any);
      }
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to discard working copy ${editSession.workingCopyId}`,
        'DISCARD_WORKING_COPY_ERROR',
        error as Error
      );
    }
  }

  /**
   * ノードの現在データを取得（Working Copy作成時のexpectedUpdatedAt設定用）
   * 
   * TODO: 実装時に適切なAPIを確認して修正
   * 現在は仮実装として、TreeQueryServiceを使用することを想定
   */
  private async getCurrentNodeData(_nodeId: TreeNodeId): Promise<TreeNode | undefined> {
    try {
      // TODO: WorkerAPIにgetNodeメソッドがあるかを確認し、適切に実装
      // 仮実装として、observeNodeを使用してinitial valueを取得する方法も考えられる
      
      // 一時的に undefined を返す（実装時に修正）
      console.warn('getCurrentNodeData: temporary implementation, needs proper TreeQueryService integration');
      return undefined;
    } catch (error) {
      console.error('Failed to get current node data:', error);
      return undefined;
    }
  }
}