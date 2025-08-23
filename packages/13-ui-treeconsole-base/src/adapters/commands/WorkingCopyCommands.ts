/**
 * WorkingCopyCommands Adapter
 *
 * 既存TreeConsoleのWorking Copy操作を新しいWorkerAPIのCommandEnvelope形式に変換します。
 * ノードの編集開始、変更の保存、破棄などのWorking Copyパターンを提供します。
 */

import type { WorkerAPI } from '@hierarchidb/01-api';
import type {
  NodeId,
  TreeNode,
  Timestamp,

  CommitWorkingCopyPayload,
  CommitWorkingCopyForCreatePayload,
  DiscardWorkingCopyPayload,
} from '@hierarchidb/00-core';
import { createCommand, createAdapterCommandId } from '../utils';
import type { CommandAdapterOptions } from '../../types/index';
import { TreeConsoleAdapterError } from '../../types/index';

export interface WorkingCopyEditSession {
  workingCopyId: string;
  sourceNodeId?: NodeId;
  parentNodeId?: NodeId;
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
    sourceNodeId: NodeId,
    _options: CommandAdapterOptions
  ): Promise<WorkingCopyEditSession> {
    try {
      // Command creation is no longer needed with the new API
      const workingCopyId = createAdapterCommandId();

      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      await workingCopyAPI.createWorkingCopyFromNode(sourceNodeId);

      // 現在のノードデータを取得（expectedUpdatedAtの設定用）
      const currentNodeData = await this.getCurrentNodeData(sourceNodeId);

      return {
        workingCopyId,
        sourceNodeId,
        isCreate: false,
        expectedUpdatedAt: currentNodeData?.updatedAt,
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
    parentNodeId: NodeId,
    name: string,
    _description: string | undefined,
    nodeType: string,
    _options: CommandAdapterOptions
  ): Promise<WorkingCopyEditSession> {
    try {
      // Command creation is no longer needed with the new API
      
      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      const workingCopy = await workingCopyAPI.createDraftWorkingCopy(
        nodeType,
        parentNodeId,
        { name }
      );

      return {
        workingCopyId: workingCopy.id,
        parentNodeId,
        isCreate: true,
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
      const command = createCommand(
        'commitWorkingCopy',
        {
          workingCopyId: editSession.workingCopyId,
          expectedUpdatedAt: editSession.expectedUpdatedAt!,
          onNameConflict: options.context?.onNameConflict,
        } as CommitWorkingCopyPayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      const result = await workingCopyAPI.commitWorkingCopy(command.payload.workingCopyId as NodeId);

      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to commit node edit: ${result.error || 'Unknown error'}`,
'COMMIT_NODE_EDIT_FAILED'
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
      const command = createCommand(
        'commitWorkingCopyForCreate',
        {
          workingCopyId: editSession.workingCopyId,
          onNameConflict: options.context?.onNameConflict,
        } as CommitWorkingCopyForCreatePayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      const result = await workingCopyAPI.commitWorkingCopy(command.payload.workingCopyId as NodeId);

      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to commit node create: ${result.error || 'Unknown error'}`,
'COMMIT_NODE_CREATE_FAILED'
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
  async discardWorkingCopy(
    editSession: WorkingCopyEditSession,
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const commandKind = editSession.isCreate
        ? 'discardWorkingCopyForCreate'
        : 'discardWorkingCopy';

      const command = createCommand(
        commandKind,
        {
          workingCopyId: editSession.workingCopyId,
        } as DiscardWorkingCopyPayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      await workingCopyAPI.discardWorkingCopy(command.payload.workingCopyId as NodeId);
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
  async getCurrentNodeData(nodeId: NodeId): Promise<TreeNode | undefined> {
    try {
      return await this.workerAPI.getQueryAPI().getNode(nodeId);
    } catch (error) {
      console.error('Failed to get current node data:', error);
      return undefined;
    }
  }
}
