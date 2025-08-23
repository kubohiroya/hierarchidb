import type { TreeId, NodeId, Tree, TreeNode } from '@hierarchidb/00-core';

/**
 * 読み取り専用データアクセスAPI
 * ツリーとノードの照会機能を提供
 */
export interface TreeQueryAPI {
  /**
   * 指定されたツリーIDのツリー情報を取得
   * @param treeId - 取得するツリーのID
   * @returns ツリー情報、存在しない場合はundefined
   */
  getTree(treeId: TreeId): Promise<Tree | undefined>;

  /**
   * すべてのツリー一覧を取得
   * @returns 全ツリーの配列
   */
  listTrees(): Promise<Tree[]>;

  /**
   * 指定されたノードIDのノード情報を取得
   * @param nodeId - 取得するノードのID
   * @returns ノード情報、存在しない場合はundefined
   */
  getNode(nodeId: NodeId): Promise<TreeNode | undefined>;

  /**
   * 指定されたノードの直接の子ノード一覧を取得
   * @param parentId - 親ノードのID
   * @returns 子ノードの配列
   */
  listChildren(parentId: NodeId): Promise<TreeNode[]>;

  /**
   * 指定されたノードの子孫ノード一覧を取得
   * @param nodeId - 起点ノードのID
   * @param maxDepth - 最大探索深度（省略時は無制限）
   * @returns 子孫ノードの配列
   */
  listDescendants(nodeId: NodeId, maxDepth?: number): Promise<TreeNode[]>;

  /**
   * 指定されたノードの祖先ノード一覧を取得
   * @param nodeId - 起点ノードのID
   * @returns 祖先ノードの配列（ルートから順）
   */
  listAncestors(nodeId: NodeId): Promise<TreeNode[]>;

  /**
   * ノード検索（統合検索機能）
   * @param options - 検索オプション
   * @param options.rootNodeId - 検索開始ノードのID
   * @param options.query - 検索クエリ文字列
   * @param options.mode - マッチモード（デフォルト: 'partial'）
   * @param options.maxDepth - 最大検索深度
   * @param options.maxResults - 最大結果数
   * @param options.caseSensitive - 大文字小文字を区別するか（デフォルト: false）
   * @param options.searchInDescription - 説明文も検索対象とするか（デフォルト: false）
   * @returns マッチしたノードの配列
   */
  searchNodes(options: {
    rootNodeId: NodeId;
    query: string;
    mode?: 'exact' | 'prefix' | 'suffix' | 'partial';
    maxDepth?: number;
    maxResults?: number;
    caseSensitive?: boolean;
    searchInDescription?: boolean;
  }): Promise<TreeNode[]>;
}