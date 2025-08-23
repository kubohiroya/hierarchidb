import type { NodeId } from '@hierarchidb/00-core';
import { BaseReferenceCountingHandler } from './ReferenceCountingHandler';
import { SpreadsheetDB, type SpreadsheetMetadata, type SpreadsheetMetadataId, type SpreadsheetRefEntity, type SpreadsheetChunk } from '../db/SpreadsheetDB';

/**
 * Worker-side implementation of SpreadsheetEntityHandler
 * Uses independent SpreadsheetDB for complete plugin isolation
 */
export class SpreadsheetWorkerHandler extends BaseReferenceCountingHandler {
  private spreadsheetDB: SpreadsheetDB;

  constructor(spreadsheetDB: SpreadsheetDB) {
    super(); // プラグインは独立データベースを使用するため、CoreDB/EphemeralDBは渡さない
    this.spreadsheetDB = spreadsheetDB;
  }

  // BaseReferenceCountingHandler implementation
  protected getNodeRefField(): string {
    return 'nodeId'; // Default field name from EntityReferenceHints
  }

  protected getRelRefField(): string {
    return 'metadataId'; // Custom field name from EntityReferenceHints
  }

  protected async getPeerEntity(nodeId: NodeId): Promise<SpreadsheetRefEntity | null> {
    // 独立データベースを使用
    const result = await this.spreadsheetDB.getRef(nodeId);
    return result || null;
  }

  protected async deletePeerEntity(nodeId: NodeId): Promise<void> {
    // 独立データベースを使用
    await this.spreadsheetDB.deleteRef(nodeId);
  }

  protected async countPeerEntitiesByRelRef(relRef: SpreadsheetMetadataId): Promise<number> {
    // 独立データベースで参照カウント
    return await this.spreadsheetDB.countRefsForMetadata(relRef);
  }

  protected async deleteRelationalEntity(relRef: SpreadsheetMetadataId): Promise<void> {
    // 独立データベースでRelationalEntity削除
    await this.spreadsheetDB.deleteMetadata(relRef);
    await this.spreadsheetDB.deleteChunks(relRef);
  }

  // Public wrapper for protected getPeerEntity
  async getSpreadsheetRef(nodeId: NodeId): Promise<SpreadsheetRefEntity | null> {
    return await this.getPeerEntity(nodeId);
  }

  // Additional Worker-specific methods
  
  /**
   * Create SpreadsheetRefEntity in database
   */
  async createSpreadsheetRef(ref: SpreadsheetRefEntity): Promise<void> {
    await this.spreadsheetDB.createRef(ref);
  }

  /**
   * Create SpreadsheetMetadata in database
   */
  async createSpreadsheetMetadata(metadata: SpreadsheetMetadata): Promise<void> {
    await this.spreadsheetDB.createMetadata(metadata);
  }

  /**
   * Create SpreadsheetChunks in database
   */
  async createSpreadsheetChunks(chunks: SpreadsheetChunk[]): Promise<void> {
    await this.spreadsheetDB.createChunks(chunks);
  }

  /**
   * Get SpreadsheetMetadata by ID
   */
  async getSpreadsheetMetadata(metadataId: SpreadsheetMetadataId): Promise<SpreadsheetMetadata | null> {
    const result = await this.spreadsheetDB.getMetadata(metadataId);
    return result || null;
  }

  /**
   * Get SpreadsheetChunks by metadata ID
   */
  async getSpreadsheetChunks(metadataId: SpreadsheetMetadataId): Promise<SpreadsheetChunk[]> {
    return await this.spreadsheetDB.getChunks(metadataId);
  }

  /**
   * Find SpreadsheetMetadata by content hash
   */
  async findMetadataByContentHash(contentHash: string): Promise<SpreadsheetMetadata | null> {
    const result = await this.spreadsheetDB.findMetadataByContentHash(contentHash);
    return result || null;
  }

  /**
   * Update last accessed timestamp
   */
  async updateLastAccessed(metadataId: SpreadsheetMetadataId): Promise<void> {
    await this.spreadsheetDB.updateLastAccessed(metadataId);
  }

  /**
   * Delete SpreadsheetRefEntity by nodeId
   */
  async deleteSpreadsheetRef(nodeId: NodeId): Promise<void> {
    await this.deletePeerEntity(nodeId);
  }

  /**
   * Count SpreadsheetRefEntity by metadataId
   */
  async countSpreadsheetRefsByMetadata(metadataId: SpreadsheetMetadataId): Promise<number> {
    return await this.countPeerEntitiesByRelRef(metadataId);
  }

  /**
   * Delete SpreadsheetMetadata and chunks
   */
  async deleteSpreadsheetMetadata(metadataId: SpreadsheetMetadataId): Promise<void> {
    await this.deleteRelationalEntity(metadataId);
  }

  /**
   * Delete SpreadsheetChunks
   */
  async deleteSpreadsheetChunks(metadataId: SpreadsheetMetadataId): Promise<void> {
    await this.spreadsheetDB.deleteChunks(metadataId);
  }
}