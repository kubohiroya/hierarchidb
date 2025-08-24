import Dexie, { type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-core';

// Local type definitions for StyleMapDB (plugin types not available in worker)
export type SpreadsheetMetadataId = string & { readonly __brand: 'SpreadsheetMetadataId' };

export interface ColorRule {
  id: string;
  condition: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'range';
  value: string | number;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  enabled: boolean;
}

export interface StyleMapEntity {
  nodeId: NodeId;
  spreadsheetMetadataId: SpreadsheetMetadataId;
  keyColumn: string;
  colorRules: ColorRule[];
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * StyleMapDB - 独立したスタイルマップ専用データベース
 * プラグインが自分で管理する独立したDexieデータベース
 */
export class StyleMapDB extends Dexie {
  // PeerEntity table only - StyleMapはRelationalEntityを持たない
  styleMapEntities!: Table<StyleMapEntity, NodeId>;

  constructor(name: string = 'hierarchidb-stylemap') {
    super(name);

    this.version(1).stores({
      // PeerEntity: StyleMapEntity (ノード紐付け、SpreadsheetMetadataを参照)
      styleMapEntities: '&nodeId, spreadsheetMetadataId, createdAt, updatedAt, keyColumn'
    });
  }

  /**
   * データベース初期化
   */
  async initialize(): Promise<void> {
    console.log('StyleMapDB initialized');
  }

  /**
   * StyleMapEntity operations (PeerEntity)
   */
  async createEntity(entity: StyleMapEntity): Promise<void> {
    await this.styleMapEntities.add(entity);
  }

  async getEntity(nodeId: NodeId): Promise<StyleMapEntity | undefined> {
    return await this.styleMapEntities.get(nodeId);
  }

  async updateEntity(nodeId: NodeId, updates: Partial<StyleMapEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`StyleMapEntity not found: ${nodeId}`);
    }

    await this.styleMapEntities.update(nodeId, {
      ...updates,
      updatedAt: Date.now(),
      version: existing.version + 1
    });
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    await this.styleMapEntities.delete(nodeId);
  }

  /**
   * SpreadsheetMetadata参照管理
   */
  async getEntitiesBySpreadsheetMetadata(metadataId: SpreadsheetMetadataId): Promise<StyleMapEntity[]> {
    return await this.styleMapEntities.where('spreadsheetMetadataId').equals(metadataId).toArray();
  }

  async countEntitiesBySpreadsheetMetadata(metadataId: SpreadsheetMetadataId): Promise<number> {
    return await this.styleMapEntities.where('spreadsheetMetadataId').equals(metadataId).count();
  }

  /**
   * 検索とフィルタリング
   */
  async findByKeyColumn(keyColumn: string): Promise<StyleMapEntity[]> {
    return await this.styleMapEntities.where('keyColumn').equals(keyColumn).toArray();
  }

  async getRecentlyUpdated(limit = 10): Promise<StyleMapEntity[]> {
    return await this.styleMapEntities.orderBy('updatedAt').reverse().limit(limit).toArray();
  }

  /**
   * 統計情報取得
   */
  async getStats(): Promise<{
    totalEntities: number;
    uniqueSpreadsheetRefs: number;
    averageRulesPerEntity: number;
    recentlyActive: number; // 過去24時間で更新されたエンティティ数
  }> {
    const allEntities = await this.styleMapEntities.toArray();
    const totalEntities = allEntities.length;

    // ユニークなSpreadsheetMetadata参照数
    const uniqueSpreadsheetRefs = new Set(
      allEntities.map(entity => entity.spreadsheetMetadataId)
    ).size;

    // 平均ルール数
    const totalRules = allEntities.reduce((sum, entity) => sum + entity.colorRules.length, 0);
    const averageRulesPerEntity = totalEntities > 0 ? totalRules / totalEntities : 0;

    // 過去24時間で更新されたエンティティ数
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentlyActive = allEntities.filter(entity => entity.updatedAt > oneDayAgo).length;

    return {
      totalEntities,
      uniqueSpreadsheetRefs,
      averageRulesPerEntity,
      recentlyActive
    };
  }

  /**
   * バルク操作
   */
  async bulkUpdateEntities(updates: Array<{ nodeId: NodeId; data: Partial<StyleMapEntity> }>): Promise<void> {
    const updatePromises = updates.map(({ nodeId, data }) => 
      this.updateEntity(nodeId, data)
    );
    await Promise.all(updatePromises);
  }

  async bulkDeleteEntities(nodeIds: NodeId[]): Promise<void> {
    await this.styleMapEntities.bulkDelete(nodeIds);
  }

  /**
   * データ整合性チェック
   */
  async validateIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    const entities = await this.styleMapEntities.toArray();

    for (const entity of entities) {
      // 必須フィールドチェック
      if (!entity.nodeId) {
        issues.push(`Entity missing nodeId: ${JSON.stringify(entity)}`);
      }
      if (!entity.spreadsheetMetadataId) {
        issues.push(`Entity ${entity.nodeId} missing spreadsheetMetadataId`);
      }
      if (!entity.keyColumn) {
        issues.push(`Entity ${entity.nodeId} missing keyColumn`);
      }

      // バージョン整合性チェック
      if (entity.version < 1) {
        issues.push(`Entity ${entity.nodeId} has invalid version: ${entity.version}`);
      }

      // タイムスタンプ整合性チェック
      if (entity.updatedAt < entity.createdAt) {
        issues.push(`Entity ${entity.nodeId} has updatedAt < createdAt`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}