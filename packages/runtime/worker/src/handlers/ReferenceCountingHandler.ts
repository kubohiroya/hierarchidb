import type { NodeId } from '@hierarchidb/common-core';
import type { CoreDB } from '../db/CoreDB';
import type { EphemeralDB } from '../db/EphemeralDB';

/**
 * Interface for entity handlers that support reference counting
 * Used by LifecycleManager to manage RelationalEntity lifecycle
 */
export interface ReferenceCountingHandler {
  /**
   * Increment reference count when a new PeerEntity is created
   * Called by LifecycleManager after node creation
   */
  incrementReferenceCount(nodeId: NodeId): Promise<void>;

  /**
   * Decrement reference count when a PeerEntity is deleted
   * Called by LifecycleManager before node deletion
   * Should delete RelationalEntity if count reaches 0
   */
  decrementReferenceCount(nodeId: NodeId): Promise<void>;

  /**
   * Get current reference count for debugging/monitoring
   * Optional method for development tools
   */
  getReferenceCount?(nodeId: NodeId): Promise<number>;
}

/**
 * Type guard to check if handler supports reference counting
 */
export function isReferenceCountingHandler(handler: any): handler is ReferenceCountingHandler {
  return handler &&
    typeof handler.incrementReferenceCount === 'function' &&
    typeof handler.decrementReferenceCount === 'function';
}

/**
 * Base implementation for reference counting handlers
 * Counts PeerEntities instead of using refCount field
 */
export abstract class BaseReferenceCountingHandler implements ReferenceCountingHandler {
  protected coreDB?: CoreDB;
  protected ephemeralDB?: EphemeralDB;

  constructor(coreDB?: CoreDB, ephemeralDB?: EphemeralDB) {
    this.coreDB = coreDB;
    this.ephemeralDB = ephemeralDB;
  }

  protected abstract getNodeRefField(): string;
  protected abstract getRelRefField(): string;
  
  protected abstract getPeerEntity(nodeId: NodeId): Promise<any>;
  protected abstract deletePeerEntity(nodeId: NodeId): Promise<void>;
  protected abstract deleteRelationalEntity(relRef: any): Promise<void>;
  protected abstract countPeerEntitiesByRelRef(relRef: any): Promise<number>;

  async incrementReferenceCount(nodeId: NodeId): Promise<void> {
    // PeerEntityが作成されることで、自然に参照カウントが増加
    // 実際の処理は不要（PeerEntity作成のライフサイクルで自動処理）
  }

  async decrementReferenceCount(nodeId: NodeId): Promise<void> {
    const peerEntity = await this.getPeerEntity(nodeId);
    if (!peerEntity) {
      return; // No PeerEntity found
    }

    const relRefField = this.getRelRefField();
    const relRef = peerEntity[relRefField];

    // PeerEntityを削除
    await this.deletePeerEntity(nodeId);

    // 残りのPeerEntityの数をカウント
    const remainingCount = await this.countPeerEntitiesByRelRef(relRef);

    // 参照がなくなったらRelationalEntityを削除
    if (remainingCount === 0) {
      await this.deleteRelationalEntity(relRef);
    }
  }

  async getReferenceCount(nodeId: NodeId): Promise<number> {
    const peerEntity = await this.getPeerEntity(nodeId);
    if (!peerEntity) {
      return 0;
    }

    const relRefField = this.getRelRefField();
    const relRef = peerEntity[relRefField];
    
    // RelRefを参照しているPeerEntityの数を返す
    return await this.countPeerEntitiesByRelRef(relRef);
  }
}