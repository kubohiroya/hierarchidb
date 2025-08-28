// =============================================================================
// Plugin Definition Types (moved from worker package)
// =============================================================================

import { RelationalEntity } from './entity-types';
import { NodeId } from './id-types';

// =============================================================================
// RelationalEntity管理用のインターフェース
// =============================================================================

/**
 * RelationalEntityの参照管理インターフェース
 */
export interface RelationalEntityManager<TRelationalEntity extends RelationalEntity> {
  /**
   * 新しい参照を追加（参照カウントをインクリメント）
   */
  addReference(entityId: string, nodeId: NodeId): Promise<void>;

  /**
   * 参照を削除（参照カウントをデクリメント、0になったら削除）
   */
  removeReference(entityId: string, nodeId: NodeId): Promise<void>;

  /**
   * エンティティを取得（存在しない場合は undefined）
   */
  getEntity(entityId: string): Promise<TRelationalEntity | undefined>;

  /**
   * エンティティを作成（初期参照カウント=1）
   */
  createEntity(
    nodeId: NodeId,
    data: Omit<TRelationalEntity, keyof RelationalEntity>
  ): Promise<TRelationalEntity>;

  /**
   * 指定ノードが参照しているエンティティの一覧を取得
   */
  getReferencedEntities(nodeId: NodeId): Promise<TRelationalEntity[]>;

  /**
   * 孤立エンティティ（参照カウント=0）をクリーンアップ
   */
  cleanupOrphanedEntities(): Promise<number>; // 削除した数を返す
}
