/**
 * TreeMutationCommands Adapter
 *
 * 既存TreeConsoleのCRUD操作を新しいWorkerAPIのCommandEnvelope形式に変換します。
 * ノードの移動、削除、複製などの基本操作を提供します。
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type {
  NodeId,
  MoveNodesPayload,
  MoveToTrashPayload,
  DuplicateNodesPayload,

  RemovePayload,
  RecoverFromTrashPayload,
} from '@hierarchidb/common-core';
import { createCommand } from '../utils';
import type { CommandAdapterOptions } from '../../types/index';
import { TreeConsoleAdapterError } from '../../types/index';

export class TreeMutationCommandsAdapter {
  constructor(private workerAPI: WorkerAPI) {}

  /**
   * ノード移動（既存のmoveNodesに相当）
   *
   * @param nodeIds 移動対象のノードID配列
   * @param targetParentId 移動先の親ノードID
   * @param options アダプター実行オプション
   * @returns Promise<void>
   */
  async moveNodes(
    nodeIds: NodeId[],
    targetParentId: NodeId,
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const command = createCommand(
        'moveNodes',
        {
          nodeIds,
          toParentId: targetParentId,
          onNameConflict: options.context?.onNameConflict,
        } as MoveNodesPayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const mutationAPI = await this.workerAPI.getMutationAPI();
      const result = await mutationAPI.moveNodes({
        nodeIds: command.payload.nodeIds,
        toParentId: command.payload.toParentId,
        onNameConflict: command.payload.onNameConflict
      });

      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to move nodes: ${result.error || 'Unknown error'}`,
          'MOVE_NODES_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Move operation failed for nodes [${nodeIds.join(', ')}]`,
        'MOVE_NODES_ADAPTER_ERROR',
        error as Error
      );
    }
  }

  /**
   * ノードをゴミ箱に移動（ソフトデリート）
   *
   * @param nodeIds 削除対象のノードID配列
   * @param options アダプター実行オプション
   * @returns Promise<void>
   */
  async deleteNodes(nodeIds: NodeId[], options: CommandAdapterOptions): Promise<void> {
    try {
      const command = createCommand(
        'moveToTrash',
        {
          nodeIds,
        } as MoveToTrashPayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const mutationAPI = await this.workerAPI.getMutationAPI();
      const result = await mutationAPI.moveNodesToTrash(command.payload.nodeIds);

      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to delete nodes: ${result.error || 'Unknown error'}`,
          'DELETE_NODES_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Delete operation failed for nodes [${nodeIds.join(', ')}]`,
        'DELETE_NODES_ADAPTER_ERROR',
        error as Error
      );
    }
  }

  /**
   * ノードの複製
   *
   * @param nodeIds 複製対象のノードID配列
   * @param targetParentId 複製先の親ノードID
   * @param options アダプター実行オプション
   * @returns Promise<void>
   */
  async duplicateNodes(
    nodeIds: NodeId[],
    targetParentId: NodeId,
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const command = createCommand(
        'duplicateNodes',
        {
          nodeIds,
          toParentId: targetParentId,
          onNameConflict: options.context?.onNameConflict,
        } as DuplicateNodesPayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const mutationAPI = await this.workerAPI.getMutationAPI();
      const result = await mutationAPI.duplicateNodes({
        nodeIds: command.payload.nodeIds,
        toParentId: command.payload.toParentId
      });

      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to duplicate nodes: ${result.error || 'Unknown error'}`,
          'DUPLICATE_NODES_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Duplicate operation failed for nodes [${nodeIds.join(', ')}]`,
        'DUPLICATE_NODES_ADAPTER_ERROR',
        error as Error
      );
    }
  }

  /**
   * ノードの貼り付け（クリップボードから）
   *
   * @param targetParentId 貼り付け先の親ノードID
   * @param options アダプター実行オプション
   * @returns Promise<void>
   */
  async pasteNodes(targetParentId: NodeId, _options: CommandAdapterOptions): Promise<void> {
    try {
      // Command creation is no longer needed with the new API
      // const command = createCommand(...);

      // TODO: pasteNodes is not directly available in new API, need to check implementation
      const result = { success: false, error: 'pasteNodes not implemented in new API' };

      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to paste nodes: ${result.error || 'Unknown error'}`,
          'PASTE_NODES_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Paste operation failed to parent ${targetParentId}`,
        'PASTE_NODES_ADAPTER_ERROR',
        error as Error
      );
    }
  }

  /**
   * ノードの完全削除（パーマネントデリート）
   *
   * @param nodeIds 完全削除対象のノードID配列
   * @param options アダプター実行オプション
   * @returns Promise<void>
   */
  async removeNodes(nodeIds: NodeId[], options: CommandAdapterOptions): Promise<void> {
    try {
      const command = createCommand(
        'remove',
        {
          nodeIds,
        } as RemovePayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const mutationAPI = await this.workerAPI.getMutationAPI();
      const result = await mutationAPI.removeNodes(command.payload.nodeIds);

      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to remove nodes: ${result.error || 'Unknown error'}`,
          'PERMANENT_DELETE_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Permanent delete operation failed for nodes [${nodeIds.join(', ')}]`,
        'PERMANENT_DELETE_ADAPTER_ERROR',
        error as Error
      );
    }
  }

  /**
   * ゴミ箱からの復元
   *
   * @param nodeIds 復元対象のノードID配列
   * @param targetParentId 復元先の親ノードID（省略時は元の場所）
   * @param options アダプター実行オプション
   * @returns Promise<void>
   */
  async recoverFromTrash(
    nodeIds: NodeId[],
    targetParentId: NodeId | undefined,
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const command = createCommand(
        'recoverFromTrash',
        {
          nodeIds,
          toParentId: targetParentId,
          onNameConflict: options.context?.onNameConflict,
        } as RecoverFromTrashPayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const mutationAPI = await this.workerAPI.getMutationAPI();
      const result = await mutationAPI.recoverNodesFromTrash({
        nodeIds: command.payload.nodeIds,
        toParentId: command.payload.toParentId
      });

      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to recover nodes from trash: ${result.error || 'Unknown error'}`,
          'RECOVER_FROM_TRASH_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Recovery operation failed for nodes [${nodeIds.join(', ')}]`,
        'RECOVER_FROM_TRASH_ADAPTER_ERROR',
        error as Error
      );
    }
  }
}
