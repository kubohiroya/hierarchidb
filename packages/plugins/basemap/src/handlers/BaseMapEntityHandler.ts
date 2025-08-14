/**
 * BaseMapエンティティハンドラー
 * Worker側で実行される、データベース操作とビジネスロジック
 */
import type { TreeNodeId } from '@hierarchidb/core';
// import { EntityHandler } from '@hierarchidb/worker/handlers'; // TODO: Fix module path
interface EntityHandler<T, _S, W> {
  createEntity(nodeId: TreeNodeId, data?: Partial<T>): Promise<T>;
  getEntity(nodeId: TreeNodeId): Promise<T | undefined>;
  updateEntity(nodeId: TreeNodeId, data: Partial<T>): Promise<void>;
  deleteEntity(nodeId: TreeNodeId): Promise<void>;
  createWorkingCopy(nodeId: TreeNodeId): Promise<W>;
  commitWorkingCopy(nodeId: TreeNodeId, workingCopy: W): Promise<void>;
  discardWorkingCopy(workingCopyId: string): Promise<void>;
}
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';

/**
 * BaseMap用のエンティティハンドラー
 * 通常のCRUD操作に加えて、地図固有の操作を提供
 */
export class BaseMapEntityHandler
  implements EntityHandler<BaseMapEntity, never, BaseMapWorkingCopy>
{
  // ==================
  // 基本的なCRUD操作
  // ==================

  async createEntity(nodeId: TreeNodeId, data?: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    const entity: BaseMapEntity = {
      nodeId,
      name: data?.name || 'New BaseMap',
      mapStyle: data?.mapStyle || 'streets',
      center: data?.center || [0, 0],
      zoom: data?.zoom || 10,
      bearing: data?.bearing || 0,
      pitch: data?.pitch || 0,
      bounds: data?.bounds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    // プラグインのテーブルに保存
    // this.coreDB.table('basemaps').add(entity);
    return entity;
  }

  async getEntity(_nodeId: TreeNodeId): Promise<BaseMapEntity | undefined> {
    // return await this.coreDB.table('basemaps').get(nodeId);
    return undefined;
  }

  async updateEntity(_nodeId: TreeNodeId, _data: Partial<BaseMapEntity>): Promise<void> {
    // await this.coreDB.table('basemaps').update(nodeId, {
    //   ...data,
    //   updatedAt: Date.now()
    // });
  }

  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    // await this.coreDB.table('basemaps').delete(nodeId);
    await this.clearTileCache(nodeId);
  }

  // ==================
  // プラグイン固有の特殊API
  // ==================

  /**
   * 地図スタイルを変更
   */
  async changeMapStyle(nodeId: TreeNodeId, style: BaseMapEntity['mapStyle']): Promise<void> {
    await this.updateEntity(nodeId, { mapStyle: style });
    await this.clearTileCache(nodeId);
  }

  /**
   * 地図の表示範囲を設定
   */
  async setBounds(nodeId: TreeNodeId, bounds: [[number, number], [number, number]]): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) throw new Error('BaseMap not found');

    const center = this.calculateCenter(bounds);
    const zoom = this.calculateZoom(bounds);

    await this.updateEntity(nodeId, {
      bounds,
      center,
      zoom,
    });
  }

  /**
   * タイルキャッシュをクリア
   */
  async clearTileCache(_nodeId: TreeNodeId): Promise<void> {
    // await this.ephemeralDB.table('basemap_tiles_cache')
    //   .where('tileId')
    //   .startsWith(nodeId)
    //   .delete();
  }

  /**
   * 近くの地図ノードを検索
   */
  async findNearbyMaps(_center: [number, number], _radius: number): Promise<BaseMapEntity[]> {
    // const allMaps = await this.coreDB.table('basemaps').toArray();
    // return allMaps.filter(map => {
    //   const distance = this.calculateDistance(center, map.center);
    //   return distance <= radius;
    // });
    return [];
  }

  // ==================
  // ヘルパーメソッド
  // ==================

  private calculateCenter(bounds: [[number, number], [number, number]]): [number, number] {
    const [[west, south], [east, north]] = bounds;
    return [(west + east) / 2, (south + north) / 2];
  }

  private calculateZoom(bounds: [[number, number], [number, number]]): number {
    const [[west, south], [east, north]] = bounds;
    const maxDiff = Math.max(Math.abs(east - west), Math.abs(north - south));

    if (maxDiff > 180) return 1;
    if (maxDiff > 90) return 2;
    if (maxDiff > 45) return 3;
    if (maxDiff > 22.5) return 4;
    if (maxDiff > 11.25) return 5;
    if (maxDiff > 5.625) return 6;
    if (maxDiff > 2.813) return 7;
    if (maxDiff > 1.406) return 8;
    if (maxDiff > 0.703) return 9;
    return 10;
  }

  // Distance calculation method removed as it was unused

  // toRadians method removed as it was unused

  // ==================
  // Required Working Copy Methods
  // ==================

  async createWorkingCopy(nodeId: TreeNodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) throw new Error('BaseMap not found');

    const workingCopy: BaseMapWorkingCopy = {
      ...entity,
      workingCopyId: `${nodeId}_${Date.now()}`,
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false,
    };

    // Save to ephemeral DB
    // await this.ephemeralDB.table('basemap_workingcopies').add(workingCopy);

    return workingCopy;
  }

  async commitWorkingCopy(nodeId: TreeNodeId, workingCopy: BaseMapWorkingCopy): Promise<void> {
    const { workingCopyId, workingCopyOf, copiedAt, isDirty, ...entityData } = workingCopy;
    await this.updateEntity(nodeId, entityData);

    // Clean up working copy
    // await this.ephemeralDB.table('basemap_workingcopies').delete(workingCopyId);
  }

  async discardWorkingCopy(_workingCopyId: string): Promise<void> {
    // await this.ephemeralDB.table('basemap_workingcopies').delete(workingCopyId);
  }
}
