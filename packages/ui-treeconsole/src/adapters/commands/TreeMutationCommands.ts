/**
 * TreeMutationCommands Adapter
 * 
 * 既存TreeConsoleのCRUD操作を新しいWorkerAPIのCommandEnvelope形式に変換します。
 * ノードの移動、削除、複製などの基本操作を提供します。
 */

import type { WorkerAPI } from '@hierarchidb/api';
import type {
  TreeNodeId,
  MoveNodesPayload,
  MoveToTrashPayload,
  DuplicateNodesPayload,
  PasteNodesPayload,
  PermanentDeletePayload,
  RecoverFromTrashPayload
} from '@hierarchidb/core';
import { createCommand } from '../utils';
import type { CommandAdapterOptions } from '../types';
import { TreeConsoleAdapterError } from '../types';

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
    nodeIds: TreeNodeId[],
    targetParentId: TreeNodeId,
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const command = createCommand('moveNodes', {
        nodeIds,
        toParentId: targetParentId,
        onNameConflict: options.context.onNameConflict
      } as MoveNodesPayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      const result = await this.workerAPI.moveNodes(command);
      
      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to move nodes: ${result.error || 'Unknown error'}`,
          result.code || 'MOVE_NODES_FAILED'
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
  async deleteNodes(
    nodeIds: TreeNodeId[],
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const command = createCommand('moveToTrash', {
        nodeIds
      } as MoveToTrashPayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      const result = await this.workerAPI.moveToTrash(command);
      
      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to delete nodes: ${result.error || 'Unknown error'}`,
          result.code || 'DELETE_NODES_FAILED'
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
    nodeIds: TreeNodeId[],
    targetParentId: TreeNodeId,
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const command = createCommand('duplicateNodes', {
        nodeIds,
        toParentId: targetParentId,
        onNameConflict: options.context.onNameConflict
      } as DuplicateNodesPayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      const result = await this.workerAPI.duplicateNodes(command);
      
      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to duplicate nodes: ${result.error || 'Unknown error'}`,
          result.code || 'DUPLICATE_NODES_FAILED'
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
  async pasteNodes(
    targetParentId: TreeNodeId,
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const command = createCommand('pasteNodes', {
        toParentId: targetParentId,
        onNameConflict: options.context.onNameConflict
      } as PasteNodesPayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      const result = await this.workerAPI.pasteNodes(command);
      
      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to paste nodes: ${result.error || 'Unknown error'}`,
          result.code || 'PASTE_NODES_FAILED'
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
  async permanentDeleteNodes(
    nodeIds: TreeNodeId[],
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const command = createCommand('permanentDelete', {
        nodeIds
      } as PermanentDeletePayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      const result = await this.workerAPI.permanentDelete(command);
      
      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to permanently delete nodes: ${result.error || 'Unknown error'}`,
          result.code || 'PERMANENT_DELETE_FAILED'
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
    nodeIds: TreeNodeId[],
    targetParentId: TreeNodeId | undefined,
    options: CommandAdapterOptions
  ): Promise<void> {
    try {
      const command = createCommand('recoverFromTrash', {
        nodeIds,
        toParentId: targetParentId,
        onNameConflict: options.context.onNameConflict
      } as RecoverFromTrashPayload, {
        groupId: options.context.groupId,
        sourceViewId: options.context.viewId
      });

      const result = await this.workerAPI.recoverFromTrash(command);
      
      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to recover nodes from trash: ${result.error || 'Unknown error'}`,
          result.code || 'RECOVER_FROM_TRASH_FAILED'
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