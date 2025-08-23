import type { NodeId } from '@hierarchidb/00-core';
import { BaseReferenceCountingHandler } from './ReferenceCountingHandler';
import { StyleMapDB, type StyleMapEntity, type SpreadsheetMetadataId } from '../db/StyleMapDB';

/**
 * Worker-side implementation of StyleMapEntityHandler
 * Uses independent StyleMapDB for complete plugin isolation
 */
export class StyleMapWorkerHandler extends BaseReferenceCountingHandler {
  private styleMapDB: StyleMapDB;

  constructor(styleMapDB: StyleMapDB) {
    super(); // プラグインは独立データベースを使用するため、CoreDB/EphemeralDBは渡さない
    this.styleMapDB = styleMapDB;
  }

  // BaseReferenceCountingHandler implementation
  protected getNodeRefField(): string {
    return 'nodeId'; // Default field name from EntityReferenceHints
  }

  protected getRelRefField(): string {
    return 'spreadsheetMetadataId'; // Custom field name from EntityReferenceHints
  }

  protected async getPeerEntity(nodeId: NodeId): Promise<StyleMapEntity | null> {
    // 独立データベースを使用
    const result = await this.styleMapDB.getEntity(nodeId);
    return result || null;
  }

  protected async deletePeerEntity(nodeId: NodeId): Promise<void> {
    // 独立データベースを使用
    await this.styleMapDB.deleteEntity(nodeId);
  }

  protected async countPeerEntitiesByRelRef(relRef: SpreadsheetMetadataId): Promise<number> {
    // 独立データベースで参照カウント
    return await this.styleMapDB.countEntitiesBySpreadsheetMetadata(relRef);
  }

  protected async deleteRelationalEntity(relRef: SpreadsheetMetadataId): Promise<void> {
    // StyleMap doesn't own the SpreadsheetMetadata
    // The RelationalEntity deletion is handled by SpreadsheetWorkerHandler
    // This method should be empty for StyleMap
  }

  // Additional Worker-specific methods

  /**
   * Create StyleMapEntity in database
   */
  async createStyleMapEntity(entity: StyleMapEntity): Promise<void> {
    await this.styleMapDB.createEntity(entity);
  }

  /**
   * Get StyleMapEntity by nodeId
   */
  async getStyleMapEntity(nodeId: NodeId): Promise<StyleMapEntity | null> {
    const result = await this.styleMapDB.getEntity(nodeId);
    return result || null;
  }

  /**
   * Update StyleMapEntity
   */
  async updateStyleMapEntity(nodeId: NodeId, updates: Partial<StyleMapEntity>): Promise<void> {
    await this.styleMapDB.updateEntity(nodeId, updates);
  }

  /**
   * Delete StyleMapEntity by nodeId
   */
  async deleteStyleMapEntity(nodeId: NodeId): Promise<void> {
    await this.deletePeerEntity(nodeId);
  }

  /**
   * Get all StyleMapEntities referencing a specific SpreadsheetMetadata
   */
  async getStyleMapsBySpreadsheetMetadata(metadataId: SpreadsheetMetadataId): Promise<StyleMapEntity[]> {
    return await this.styleMapDB.getEntitiesBySpreadsheetMetadata(metadataId);
  }
}