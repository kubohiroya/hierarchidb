import type {
  SubscriptionFilter,
  Timestamp,
  TreeChangeEvent,
  TreeNode,
  NodeId,
} from '@hierarchidb/common-core';
import type { CoreDB } from '../../db/CoreDB';

/**
 * TreeObservableService用のデータベースアクセスヘルパークラス
 *
 * データベースからのノード情報取得と、初期イベント生成を担当します。
 * 実際のデータベース実装に依存せず、テスト可能な設計になっています。
 */
export class DatabaseHelper {
  constructor(private coreDB: CoreDB) {}

  /**
   * 指定されたノードIDからノード情報を取得します
   *
   * モックDBの場合は直接Mapからアクセスし、
   * 実際のDB実装では非同期クエリを実行します。
   *
   * @param nodeId 取得対象のノードID
   * @returns ノード情報（存在しない場合はundefined）
   */
  getNodeFromDB(nodeId: NodeId): TreeNode | undefined {
    // モックデータベースへの直接アクセス（テスト用）
    if (this.coreDB && 'treeNodes' in this.coreDB && this.coreDB.treeNodes instanceof Map) {
      return (this.coreDB as any).treeNodes.get(nodeId);
    }

    // 実装では、ここで実際のデータベースクエリを実行
    // return await this.coreDB.getNode(nodeId);

    // テスト環境での fallback
    return undefined;
  }

  /**
   * 指定された親ノードの子ノード一覧を取得します
   *
   * フィルタリング条件も適用され、ノードタイプによる絞り込みが可能です。
   *
   * @param parentId 親ノードのID
   * @param filter フィルタリング条件（オプション）
   * @returns 子ノードの配列
   */
  getChildNodesFromDB(parentId: NodeId, filter?: SubscriptionFilter): TreeNode[] {
    // モックデータベースへの直接アクセス（テスト用）
    if (this.coreDB && 'treeNodes' in this.coreDB && this.coreDB.treeNodes instanceof Map) {
      const allNodes = Array.from((this.coreDB as any).treeNodes.values()) as TreeNode[];
      let childNodes = allNodes.filter((node: TreeNode) => node.parentId === parentId);

      // ノードタイプフィルターの適用
      if (filter?.nodeTypes) {
        childNodes = childNodes.filter((node: TreeNode) =>
          filter.nodeTypes!.includes(node.nodeType)
        );
      }

      return childNodes;
    }

    return [];
  }

  /**
   * ノード監視用の初期イベントを生成します
   *
   * includeInitialValue=trueの場合に、現在のノード状態を
   * 'node-updated'イベントとして返します。
   *
   * @param nodeId イベント生成対象のノードID
   * @returns 初期ノードイベント
   */
  createInitialNodeEvent(nodeId: NodeId): TreeChangeEvent {
    // 現在のノード状態を取得
    const node = this.getNodeFromDB(nodeId);

    return {
      type: 'node-updated',
      nodeId,
      node,
      timestamp: Date.now() as Timestamp,
    };
  }

  /**
   * 子ノード監視用の初期イベントを生成します
   *
   * includeInitialSnapshot=trueの場合に、現在の子ノード一覧を
   * 'childNodes-changed'イベントとして返します。
   *
   * @param parentId 親ノードのID
   * @param filter フィルタリング条件（オプション）
   * @returns 初期子ノードイベント
   */
  createInitialChildNodesEvent(parentId: NodeId, filter?: SubscriptionFilter): TreeChangeEvent {
    // 現在の子ノード一覧を取得
    const childNodes = this.getChildNodesFromDB(parentId, filter);

    return {
      type: 'children-changed',
      nodeId: parentId,
      affectedChildren: childNodes.map((childNode) => childNode.id),
      timestamp: Date.now() as Timestamp,
    };
  }

  /**
   * 部分木監視用の初期イベントを生成します
   *
   * includeInitialSnapshot=trueの場合に、部分木のスナップショットを
   * イベントとして返します。現在は子ノードイベントとして実装していますが、
   * 必要に応じて完全な部分木スナップショット機能を追加できます。
   *
   * @param rootId ルートノードのID
   * @param maxDepth 最大深度制限（オプション）
   * @param filter フィルタリング条件（オプション）
   * @returns 初期部分木イベント
   */
  createInitialSubtreeEvent(
    rootId: NodeId,
    maxDepth?: number,
    filter?: SubscriptionFilter
  ): TreeChangeEvent {
    // 現在はシンプルに子ノードイベントとして実装
    // 将来的には完全な部分木スナップショット機能を追加可能
    return this.createInitialChildNodesEvent(rootId, filter);
  }

  /**
   * イベントの購読固有の変換を実行します
   *
   * 各サブスクリプションに固有の変換処理が必要な場合に使用します。
   * 現在はイベントをそのまま返しますが、将来的に以下の機能を追加可能：
   * - サブスクリプション固有のメタデータ付与
   * - イベント形式の変換
   * - 追加のフィルタリング
   *
   * @param event 変換対象のイベント
   * @param subscriptionId サブスクリプションID
   * @returns 変換されたイベント
   */
  transformEventForSubscription(event: TreeChangeEvent, subscriptionId: string): TreeChangeEvent {
    // 将来的にサブスクリプション固有の変換が必要な場合はここで実装
    // 例: event に subscriptionId を付与、形式の変換など
    return event;
  }
}
