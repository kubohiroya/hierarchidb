/**
 * BaseMap Entity Manager
 * 6分類エンティティシステム対応版
 * 
 * BaseMapはPeerEntity（TreeNodeと1:1対応）として実装
 */

import type { NodeId } from '@hierarchidb/00-core';
import type { BaseMapEntity, BaseMapWorkingCopy, MapStyleConfig } from '../types';
import { 
  PeerEntityManager,
  EphemeralPeerEntityManager,
  createPeerEntityManager,
  createEphemeralPeerEntityManager
} from '@hierarchidb/00-core';
import { BaseMapDatabase } from '../database/BaseMapDatabase';

/**
 * BaseMapエンティティマネージャー
 * PeerEntityManagerを使用してTreeNodeと1:1対応のエンティティを管理
 */
export class BaseMapEntityManager {
  private entityManager: PeerEntityManager<BaseMapEntity>;
  private workingCopyManager: EphemeralPeerEntityManager<BaseMapWorkingCopy>;
  private db: BaseMapDatabase;

  constructor() {
    this.db = BaseMapDatabase.getInstance();
    
    // PeerEntityManagerを作成（BaseMapはTreeNodeと1:1対応）
    this.entityManager = createPeerEntityManager<BaseMapEntity>(this.db);
    
    // EphemeralPeerEntityManagerを作成（WorkingCopyは一時的）
    this.workingCopyManager = createEphemeralPeerEntityManager<BaseMapWorkingCopy>(this.db);
  }

  // ==================
  // 基本的なCRUD操作
  // ==================

  /**
   * BaseMapエンティティを作成
   * TreeNodeと1:1対応で作成される
   */
  async createEntity(nodeId: NodeId, data?: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    const defaultData: Partial<BaseMapEntity> = {
      name: 'New BaseMap',
      mapStyle: 'streets',
      center: [0, 0],
      zoom: 10,
      bearing: 0,
      pitch: 0,
      ...data
    };

    // PeerEntityManagerを使用して作成
    const entity = await this.entityManager.create(nodeId, defaultData);
    
    // タイルキャッシュの初期化
    await this.initializeTileCache(nodeId);
    
    return entity;
  }

  /**
   * BaseMapエンティティを取得
   */
  async getEntity(nodeId: NodeId): Promise<BaseMapEntity | undefined> {
    return await this.entityManager.get(nodeId);
  }

  /**
   * BaseMapエンティティを更新
   */
  async updateEntity(nodeId: NodeId, data: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    // TODO: Implement update method - PeerEntityManager doesn't have update method yet
    // const updated = await this.entityManager.update(nodeId, data);
    const updated = { ...await this.entityManager.get(nodeId), ...data } as BaseMapEntity;
    
    // スタイルが変更された場合はタイルキャッシュをクリア
    if ('mapStyle' in data || 'styleUrl' in data || 'styleConfig' in data) {
      await this.clearTileCache(nodeId);
    }
    
    return updated;
  }

  /**
   * BaseMapエンティティを削除
   * TreeNode削除時に自動的に呼ばれる
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    // タイルキャッシュをクリア
    await this.clearTileCache(nodeId);
    
    // PeerEntityManagerを使用して削除
    // TODO: Implement delete method - PeerEntityManager doesn't have delete method yet
    // await this.entityManager.delete(nodeId);
    await this.entityManager.cleanup(nodeId);
  }

  /**
   * TreeNode削除時のクリーンアップ
   * PeerEntityの特性により自動削除される
   */
  async cleanup(nodeId: NodeId): Promise<void> {
    await this.entityManager.cleanup(nodeId);
  }

  // ==================
  // WorkingCopy操作
  // ==================

  /**
   * WorkingCopyを作成
   * EphemeralPeerEntityとして管理
   */
  async createWorkingCopy(nodeId: NodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`BaseMap not found: ${nodeId}`);
    }

    const workingCopyData: Partial<BaseMapWorkingCopy> = {
      ...entity,
      originalNodeId: nodeId,
      copiedAt: Date.now(),
      hasEntityCopy: true
    };

    // EphemeralPeerEntityManagerを使用して作成
    const workingCopy = await this.workingCopyManager.create(
      `${nodeId}_wc` as NodeId,
      workingCopyData
    );

    return workingCopy as BaseMapWorkingCopy;
  }

  /**
   * WorkingCopyをコミット
   */
  async commitWorkingCopy(nodeId: NodeId, workingCopy: BaseMapWorkingCopy): Promise<void> {
    if (!workingCopy.hasEntityCopy) {
      console.warn('Committing working copy with no entity copy');
      return;
    }

    // WorkingCopyからエンティティデータを抽出
    const {
      originalNodeId,
      copiedAt,
      hasEntityCopy,
      entityWorkingCopyId,
      originalVersion,
      hasGroupEntityCopy,
      ...entityData
    } = workingCopy;

    // エンティティを更新
    await this.updateEntity(nodeId, entityData);

    // WorkingCopyを削除
    await this.workingCopyManager.cleanup(`${nodeId}_wc` as NodeId);
  }

  /**
   * WorkingCopyを破棄
   */
  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    // WorkingCopyを削除
    await this.workingCopyManager.cleanup(`${nodeId}_wc` as NodeId);
  }

  // ==================
  // BaseMap固有の操作
  // ==================

  /**
   * 地図スタイルを変更
   */
  async changeMapStyle(
    nodeId: NodeId, 
    style: BaseMapEntity['mapStyle'],
    styleConfig?: MapStyleConfig
  ): Promise<void> {
    await this.updateEntity(nodeId, { 
      mapStyle: style,
      styleConfig: styleConfig || undefined
    });
  }

  /**
   * 地図の表示範囲を設定
   */
  async setBounds(
    nodeId: NodeId, 
    bounds: { north: number; south: number; east: number; west: number }
  ): Promise<void> {
    const center = this.calculateCenter(bounds);
    const zoom = this.calculateZoom(bounds);

    // Convert to BaseMapEntity bounds format
    const boundsArray: [[number, number], [number, number]] = [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north]
    ];

    await this.updateEntity(nodeId, {
      bounds: boundsArray,
      center,
      zoom,
    });
  }

  /**
   * ビューポートを更新
   */
  async updateViewport(
    nodeId: NodeId,
    viewport: {
      center?: [number, number];
      zoom?: number;
      bearing?: number;
      pitch?: number;
    }
  ): Promise<void> {
    await this.updateEntity(nodeId, viewport);
  }

  /**
   * 表示オプションを更新
   */
  async updateDisplayOptions(
    nodeId: NodeId,
    displayOptions: BaseMapEntity['displayOptions']
  ): Promise<void> {
    await this.updateEntity(nodeId, { displayOptions });
  }

  /**
   * 近くの地図ノードを検索
   */
  async findNearbyMaps(
    center: [number, number], 
    radiusKm: number
  ): Promise<BaseMapEntity[]> {
    // すべてのBaseMapエンティティを取得
    const allMaps: BaseMapEntity[] = [];
    
    // TODO: Implement proper database query
    // For now, return empty array
    return allMaps.filter(map => {
      const distance = this.calculateDistance(center, map.center);
      return distance <= radiusKm;
    });
  }

  // ==================
  // タイルキャッシュ管理
  // ==================

  /**
   * タイルキャッシュを初期化
   */
  private async initializeTileCache(nodeId: NodeId): Promise<void> {
    // TODO: Implement tile cache initialization
    console.log(`Initializing tile cache for ${nodeId}`);
  }

  /**
   * タイルキャッシュをクリア
   */
  private async clearTileCache(nodeId: NodeId): Promise<void> {
    // TODO: Implement tile cache clearing
    console.log(`Clearing tile cache for ${nodeId}`);
  }

  // ==================
  // ヘルパーメソッド
  // ==================

  /**
   * 境界から中心座標を計算
   */
  private calculateCenter(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): [number, number] {
    const { north, south, east, west } = bounds;
    return [(west + east) / 2, (south + north) / 2];
  }

  /**
   * 境界からズームレベルを計算
   */
  private calculateZoom(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): number {
    const { north, south, east, west } = bounds;
    const maxDiff = Math.max(Math.abs(east - west), Math.abs(north - south));

    // 簡易的なズームレベル計算
    if (maxDiff > 180) return 1;
    if (maxDiff > 90) return 2;
    if (maxDiff > 45) return 3;
    if (maxDiff > 22.5) return 4;
    if (maxDiff > 11.25) return 5;
    if (maxDiff > 5.625) return 6;
    if (maxDiff > 2.813) return 7;
    if (maxDiff > 1.406) return 8;
    if (maxDiff > 0.703) return 9;
    if (maxDiff > 0.352) return 10;
    if (maxDiff > 0.176) return 11;
    if (maxDiff > 0.088) return 12;
    if (maxDiff > 0.044) return 13;
    if (maxDiff > 0.022) return 14;
    return 15;
  }

  /**
   * 2点間の距離を計算（km）
   * Haversine formula
   */
  private calculateDistance(
    coord1: [number, number], 
    coord2: [number, number]
  ): number {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    
    const R = 6371; // 地球の半径（km）
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * 度をラジアンに変換
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * マネージャーのクリーンアップ
   */
  unsubscribe(): void {
    // EphemeralManagerのタイマーを停止
    if ('unsubscribe' in this.workingCopyManager && typeof this.workingCopyManager.unsubscribe === 'function') {
      (this.workingCopyManager as { unsubscribe: () => void }).unsubscribe();
    }
  }
}

// シングルトンインスタンス
let instance: BaseMapEntityManager | null = null;

/**
 * BaseMapEntityManagerのシングルトンインスタンスを取得
 */
export function getBaseMapEntityManager(): BaseMapEntityManager {
  if (!instance) {
    instance = new BaseMapEntityManager();
  }
  return instance;
}

/**
 * BaseMapEntityManagerをクリーンアップ
 */
export function cleanupBaseMapEntityManager(): void {
  if (instance) {
    instance.unsubscribe();
    instance = null;
  }
}