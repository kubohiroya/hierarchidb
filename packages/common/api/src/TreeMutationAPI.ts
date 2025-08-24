import type { TreeId, NodeId, NodeType } from '@hierarchidb/common-core';

/**
 * データ変更API
 * ノードの作成、更新、削除、移動機能を提供
 */
export interface TreeMutationAPI {
  /**
   * 新しいノードを作成
   * @param params - 作成パラメータ
   * @param params.nodeType - ノードタイプ
   * @param params.treeId - 作成先ツリーのID
   * @param params.parentId - 親ノードのID
   * @param params.name - ノード名
   * @param params.description - ノードの説明（オプション）
   * @returns 成功時は作成されたノードID、失敗時はエラー情報
   */
  createNode(params: {
    nodeType: NodeType;
    treeId: TreeId;
    parentId: NodeId;
    name: string;
    description?: string;
  }): Promise<{ success: true; nodeId: NodeId } | { success: false; error: string }>;

  /**
   * 既存ノードの情報を更新
   * @param params - 更新パラメータ
   * @param params.nodeId - 更新対象ノードのID
   * @param params.name - 新しいノード名（オプション）
   * @param params.description - 新しい説明（オプション）
   * @returns 成功・失敗の結果
   */
  updateNode(params: {
    nodeId: NodeId;
    name?: string;
    description?: string;
  }): Promise<{ success: boolean; error?: string }>;

  /**
   * ノードを別の親に移動
   * @param params - 移動パラメータ
   * @param params.nodeIds - 移動対象ノードIDの配列
   * @param params.toParentId - 移動先親ノードのID
   * @param params.onNameConflict - 名前衝突時の対処法（デフォルト: 'error'）
   * @returns 成功・失敗の結果
   */
  moveNodes(params: {
    nodeIds: NodeId[];
    toParentId: NodeId;
    onNameConflict?: 'error' | 'auto-rename';
  }): Promise<{ success: boolean; error?: string }>;

  /**
   * ノードを複製
   * @param params - 複製パラメータ
   * @param params.nodeIds - 複製対象ノードIDの配列
   * @param params.toParentId - 複製先親ノードのID（省略時は元の親）
   * @returns 成功時は複製されたノードIDの配列、失敗時はエラー情報
   */
  duplicateNodes(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: true; nodeIds: NodeId[] } | { success: false; error: string }>;

  /**
   * ノードを完全削除
   * @param nodeIds - 削除対象ノードIDの配列
   * @returns 成功・失敗の結果
   */
  removeNodes(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }>;

  /**
   * ノードをゴミ箱に移動
   * @param nodeIds - ゴミ箱移動対象ノードIDの配列
   * @returns 成功・失敗の結果
   */
  moveNodesToTrash(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }>;

  /**
   * ノードをゴミ箱から復元
   * @param params - 復元パラメータ
   * @param params.nodeIds - 復元対象ノードIDの配列
   * @param params.toParentId - 復元先親ノードのID（省略時は元の親）
   * @returns 成功・失敗の結果
   */
  recoverNodesFromTrash(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: boolean; error?: string }>;
}
