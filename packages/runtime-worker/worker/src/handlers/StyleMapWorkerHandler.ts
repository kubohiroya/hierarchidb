import type { NodeId } from '@hierarchidb/common-type';
import { BaseReferenceCountingHandler } from './ReferenceCountingHandler';
import { StylerDB, type StylerEntity, type SpreadsheetMetadataId } from '../db/StylerDB';

/**
 * Worker-side implementation of StylerEntityHandler
 * Uses independent StylerDB for complete plugin isolation
 */
export class StylerWorkerHandler extends BaseReferenceCountingHandler {
  private stylerDB: StylerDB;

  constructor(stylerDB: StylerDB) {
    super(); // プラグインは独立データベースを使用するため、CoreDB/EphemeralDBは渡さない
    this.stylerDB = stylerDB;
  }

  // BaseReferenceCountingHandler implementation
  protected getNodeRefField(): string {
    return 'nodeId'; // Default field name from EntityReferenceHints
  }

  protected getRelRefField(): string {
    return 'spreadsheetMetadataId'; // Custom field name from EntityReferenceHints
  }

  protected async getPeerEntity(nodeId: NodeId): Promise<StylerEntity | null> {
    // 独立データベースを使用
    const result = await this.stylerDB.getEntity(nodeId);
    return result || null;
  }

  protected async deletePeerEntity(nodeId: NodeId): Promise<void> {
    // 独立データベースを使用
    await this.stylerDB.deleteEntity(nodeId);
  }

  protected async countPeerEntitiesByRelRef(relRef: SpreadsheetMetadataId): Promise<number> {
    // 独立データベースで参照カウント
    return await this.stylerDB.countEntitiesBySpreadsheetMetadata(relRef);
  }

  protected async deleteRelationalEntity(relRef: SpreadsheetMetadataId): Promise<void> {
    // Styler doesn't own the SpreadsheetMetadata
    // The RelationalEntity deletion is handled by SpreadsheetWorkerHandler
    // This method should be empty for Styler
  }

  // Additional Worker-specific methods

  /**
   * Create StylerEntity in database
   */
  async createStylerEntity(entity: StylerEntity): Promise<void> {
    await this.stylerDB.createEntity(entity);
  }

  /**
   * Get StylerEntity by nodeId
   */
  async getStylerEntity(nodeId: NodeId): Promise<StylerEntity | null> {
    const result = await this.stylerDB.getEntity(nodeId);
    return result || null;
  }

  /**
   * Update StylerEntity
   */
  async updateStylerEntity(nodeId: NodeId, updates: Partial<StylerEntity>): Promise<void> {
    await this.stylerDB.updateEntity(nodeId, updates);
  }

  /**
   * Delete StylerEntity by nodeId
   */
  async deleteStylerEntity(nodeId: NodeId): Promise<void> {
    await this.deletePeerEntity(nodeId);
  }

  /**
   * Get all StylerEntities referencing a specific SpreadsheetMetadata
   */
  async getStylersBySpreadsheetMetadata(metadataId: SpreadsheetMetadataId): Promise<StylerEntity[]> {
    return await this.stylerDB.getEntitiesBySpreadsheetMetadata(metadataId);
  }
}