import type { SubscriptionFilter, TreeChangeEvent, NodeId } from '@hierarchidb/common-core';

/**
 * イベントフィルタリング機能を提供するクラス
 *
 * TreeObservableServiceV2で使用される各種監視モードに対応した
 * 効率的なイベントフィルタリングロジックを提供します。
 *
 * フィルタリングルールは以下の4つの監視タイプに対応：
 * - Node: 特定ノードのイベント
 * - Children: 子ノードのイベント
 * - Subtree: 部分木のイベント
 * - Working Copies: ワーキングコピーのイベント
 */
export class EventFilterManager {
  /**
   * データベースアクセス用の依存性
   * TreeNodeの階層情報を取得するために使用
   */
  constructor(private getNodeFromDB: (nodeId: NodeId) => any) {}

  /**
   * ノード監視用のイベントフィルタリング
   *
   * 指定されたノードに関連するイベントのみを通すフィルターです。
   * ノードの種類フィルターも適用されます。
   *
   * @param event フィルタリング対象のイベント
   * @param targetNodeId 監視対象のノードID
   * @param filter 追加のフィルタリング条件
   * @returns イベントが関連する場合true
   */
  isEventRelevantForNodeObservation(
    event: TreeChangeEvent,
    targetNodeId: NodeId,
    filter?: SubscriptionFilter
  ): boolean {
    // 対象ノード以外のイベントは除外
    if (event.nodeId !== targetNodeId) {
      return false;
    }

    // ノードタイプフィルターの適用
    if (filter?.nodeTypes && event.node) {
      if (!filter.nodeTypes.includes(event.node.nodeType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 子ノード監視用のイベントフィルタリング
   *
   * 指定された親ノードの直接の子に関連するイベントのみを通すフィルターです。
   * 移動や削除イベントも適切に処理します。
   *
   * @param event フィルタリング対象のイベント
   * @param parentNodeId 親ノードのID
   * @param filter 追加のフィルタリング条件
   * @returns イベントが関連する場合true
   */
  isEventRelevantForChildrenObservation(
    event: TreeChangeEvent,
    parentNodeId: NodeId,
    filter?: SubscriptionFilter
  ): boolean {
    // 直接の子ノードかをチェック
    const isDirectChild =
      event.parentId === parentNodeId || event.previousParentId === parentNodeId;

    // ノード削除イベントの特別処理
    if (event.type === 'node-deleted' && event.previousNode) {
      const wasChildNode = event.previousNode.parentId === parentNodeId;
      if (!isDirectChild && !wasChildNode) {
        return false;
      }
    } else if (!isDirectChild) {
      return false;
    }

    // ノードタイプフィルターの適用
    if (filter?.nodeTypes) {
      const nodeToCheck = event.node || event.previousNode;
      if (nodeToCheck && !filter.nodeTypes.includes(nodeToCheck.nodeType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 部分木監視用のイベントフィルタリング
   *
   * 指定されたルートノード以下の全ての子孫ノードのイベントを通すフィルターです。
   * 最大深度制限とノードタイプフィルターも適用されます。
   *
   * @param event フィルタリング対象のイベント
   * @param rootNodeId ルートノードのID
   * @param maxDepth 最大深度制限（オプション）
   * @param filter 追加のフィルタリング条件
   * @returns イベントが関連する場合true
   */
  isEventRelevantForSubtreeObservation(
    event: TreeChangeEvent,
    rootNodeId: NodeId,
    maxDepth?: number,
    filter?: SubscriptionFilter
  ): boolean {
    // 子孫ノードかをチェック（深度制限含む）
    const isDescendant = this.isNodeDescendantOf(event.nodeId, rootNodeId, maxDepth);

    if (!isDescendant) {
      return false;
    }

    // ノードタイプフィルターの適用
    if (filter?.nodeTypes) {
      const nodeToCheck = event.node || event.previousNode;
      if (nodeToCheck && !filter.nodeTypes.includes(nodeToCheck.nodeType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * ワーキングコピー監視用のイベントフィルタリング
   *
   * ワーキングコピーに関連するイベントを通すフィルターです。
   * 特定ノードまたは全ドラフトの監視に対応します。
   *
   * @param event フィルタリング対象のイベント
   * @param targetNodeId 対象ノードID（オプション）
   * @param includeAllDrafts 全ドラフトを含むかどうか
   * @returns イベントが関連する場合true
   */
  isEventRelevantForWorkingCopies(
    event: TreeChangeEvent,
    targetNodeId?: NodeId,
    includeAllDrafts?: boolean
  ): boolean {
    // 特定ノードが指定されている場合、そのノードのみ
    if (targetNodeId && event.nodeId !== targetNodeId) {
      return false;
    }

    // ワーキングコピーイベントの判定ロジック
    // 実装では全てのイベントを関連として扱うが、
    // 実際の運用では特定の指標（isDraftプロパティなど）を使用
    return true;
  }

  /**
   * ノードが指定された祖先ノードの子孫かどうかを判定
   *
   * 階層構造を遡って祖先関係を確認し、オプションで最大深度制限も適用します。
   * 循環参照の検出も行い、無限ループを防止します。
   *
   * @param nodeId 判定対象のノードID
   * @param ancestorId 祖先ノードのID
   * @param maxDepth 最大深度制限（オプション）
   * @returns 子孫関係にある場合true
   */
  private isNodeDescendantOf(nodeId: NodeId, ancestorId: NodeId, maxDepth?: number): boolean {
    // 自分自身は子孫として扱う
    if (nodeId === ancestorId) {
      return true;
    }

    // 祖先からの実際の深度を計算
    const depthFromAncestor = this.calculateDepth(nodeId, ancestorId);

    if (depthFromAncestor === -1) {
      return false; // 子孫関係にない
    }

    // 最大深度制限のチェック
    if (maxDepth !== undefined && depthFromAncestor > maxDepth) {
      return false;
    }

    return true;
  }

  /**
   * 祖先ノードからの深度を計算
   *
   * 指定されたノードが祖先ノードから何層下にあるかを計算します。
   * 循環参照の検出機能付きで、パフォーマンスを考慮した実装です。
   *
   * TODO: パフォーマンス改善のため、先祖パスのキャッシュ機能を検討
   *
   * @param nodeId 深度計算対象のノードID
   * @param ancestorId 祖先ノードのID
   * @returns 祖先からの深度（子孫でない場合は-1）
   */
  private calculateDepth(nodeId: NodeId, ancestorId: NodeId): number {
    const node = this.getNodeFromDB(nodeId);
    if (!node) {
      return -1;
    }

    // 直接の子（深度1）のチェック
    if (node.parentId === ancestorId) {
      return 1;
    }

    // 階層を遡って祖先を探索
    let currentNode = node;
    let depth = 0;
    const visited = new Set<NodeId>();

    while (currentNode && currentNode.parentId) {
      // 循環参照の検出
      if (visited.has(currentNode.id)) {
        break;
      }
      visited.add(currentNode.id);
      depth++;

      const parentNode = this.getNodeFromDB(currentNode.parentId);
      if (!parentNode) {
        break;
      }

      // 祖先ノードが見つかった
      if (parentNode.id === ancestorId) {
        return depth;
      }

      currentNode = parentNode;
    }

    return -1; // 子孫関係にない
  }
}
