import type { NodeId } from '@hierarchidb/00-core';
import { ChunkManager } from '~/storage/ChunkManager';
import { FileLoader } from '~/io/FileLoader';

// Local BaseReferenceCountingHandler interface (since worker package not available in plugin)
interface ReferenceCountingHandler {
  incrementReferenceCount(nodeId: NodeId): Promise<void>;
  decrementReferenceCount(nodeId: NodeId): Promise<void>;
  getReferenceCount?(nodeId: NodeId): Promise<number>;
}

abstract class BaseReferenceCountingHandler implements ReferenceCountingHandler {
  protected abstract getNodeRefField(): string;
  protected abstract getRelRefField(): string;
  
  protected abstract getPeerEntity(nodeId: NodeId): Promise<any>;
  protected abstract deletePeerEntity(nodeId: NodeId): Promise<void>;
  protected abstract deleteRelationalEntity(relRef: any): Promise<void>;
  protected abstract countPeerEntitiesByRelRef(relRef: any): Promise<number>;

  async incrementReferenceCount(_nodeId: NodeId): Promise<void> {
    // PeerEntityが作成されることで、自然に参照カウントが増加
  }

  async decrementReferenceCount(nodeId: NodeId): Promise<void> {
    const peerEntity = await this.getPeerEntity(nodeId);
    if (!peerEntity) return;

    const relRefField = this.getRelRefField();
    const relRef = peerEntity[relRefField];

    await this.deletePeerEntity(nodeId);
    const remainingCount = await this.countPeerEntitiesByRelRef(relRef);

    if (remainingCount === 0) {
      await this.deleteRelationalEntity(relRef);
    }
  }

  async getReferenceCount(nodeId: NodeId): Promise<number> {
    const peerEntity = await this.getPeerEntity(nodeId);
    if (!peerEntity) return 0;

    const relRefField = this.getRelRefField();
    const relRef = peerEntity[relRefField];
    
    return await this.countPeerEntitiesByRelRef(relRef);
  }
}
import type {
  SpreadsheetMetadata,
  SpreadsheetMetadataId,
  SpreadsheetRefEntity,
  SpreadsheetChunk,
  SpreadsheetRow,
  SpreadsheetImportOptions,
  SpreadsheetImportResult,
  SpreadsheetFilterOptions,
} from '~/entities/types';

/**
 * SpreadsheetEntityHandler manages spreadsheet metadata and chunks
 * Plugin-side interface for spreadsheet operations (implementation in Worker)
 */
export class SpreadsheetEntityHandler extends BaseReferenceCountingHandler {
  private chunkManager: ChunkManager;
  private fileLoader: FileLoader;
  
  constructor() {
    super();
    this.chunkManager = new ChunkManager();
    this.fileLoader = new FileLoader();
  }
  
  // BaseReferenceCountingHandler implementation
  protected getNodeRefField(): string {
    return 'nodeId'; // Default field name from EntityReferenceHints
  }

  protected getRelRefField(): string {
    return 'metadataId'; // Custom field name from EntityReferenceHints
  }

  protected async getPeerEntity(nodeId: NodeId): Promise<SpreadsheetRefEntity | null> {
    return await this.getSpreadsheetRef(nodeId);
  }

  protected async deletePeerEntity(nodeId: NodeId): Promise<void> {
    await this.deleteSpreadsheetRef(nodeId);
  }

  protected async deleteRelationalEntity(relRef: SpreadsheetMetadataId): Promise<void> {
    // Delete SpreadsheetMetadata and all its chunks
    await this.deleteSpreadsheetMetadata(relRef);
    await this.deleteSpreadsheetChunks(relRef);
  }

  protected async countPeerEntitiesByRelRef(relRef: SpreadsheetMetadataId): Promise<number> {
    // Count how many SpreadsheetRefEntity reference this metadataId
    return await this.countSpreadsheetRefsByMetadata(relRef);
  }
  /**
   * Create spreadsheet metadata from import result
   */
  async createEntity(
    nodeId: NodeId,
    importResult: SpreadsheetImportResult,
    options: SpreadsheetImportOptions = {}
  ): Promise<SpreadsheetMetadata> {
    // Generate metadata ID
    const metadataId = this.generateMetadataId();
    
    // Calculate content hash
    const contentHash = await this.calculateContentHash(importResult.rows, importResult.headers);
    
    // Check if metadata with same hash already exists
    const existingMetadata = await this.findByContentHash(contentHash);
    if (existingMetadata) {
      // Reuse existing metadata, just create new ref
      await this.createSpreadsheetRef(nodeId, existingMetadata.id);
      return existingMetadata;
    }

    // Create chunks
    const chunks = await this.chunkManager.createChunks(
      metadataId,
      importResult.rows,
      importResult.headers
    );

    // Create metadata
    const metadata: SpreadsheetMetadata = {
      id: metadataId,
      name: options.name || 'Spreadsheet Data',
      description: options.description,
      contentHash,
      columns: importResult.headers,
      rowCount: importResult.totalRows,
      totalRows: importResult.totalRows,
      totalChunks: chunks.length,
      columnCount: importResult.headers.length,
      fileSize: importResult.originalSize,
      originalFormat: importResult.format,
      delimiter: options.delimiter || '	',
      hasHeader: options.hasHeader !== false,
      encoding: options.encoding || 'UTF-8',
      stats: {
        numericColumns: [],
        dateColumns: [],
        textColumns: importResult.headers,
      },
      referenceCount: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      version: 1,
    };

    // Store metadata and chunks in database (this would be implemented by Worker)
    await this.storeMetadata(metadata);
    await this.storeChunks(chunks);
    
    // Create spreadsheet reference
    await this.createSpreadsheetRef(nodeId, metadataId);

    return metadata;
  }

  /**
   * Create spreadsheet reference (PeerEntity)
   */
  async createSpreadsheetRef(
    nodeId: NodeId,
    metadataId: SpreadsheetMetadataId
  ): Promise<SpreadsheetRefEntity> {
    const refEntity: SpreadsheetRefEntity = {
      nodeId,
      metadataId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    // Store in database (implemented by Worker)
    await this.storeSpreadsheetRef(refEntity);
    
    return refEntity;
  }

  /**
   * Get spreadsheet data by node ID
   */
  async getSpreadsheetData(nodeId: NodeId): Promise<{
    metadata: SpreadsheetMetadata;
    chunks: SpreadsheetChunk[];
  } | null> {
    const ref = await this.getSpreadsheetRef(nodeId);
    if (!ref) return null;

    const metadata = await this.getMetadata(ref.metadataId);
    if (!metadata) return null;

    const chunks = await this.getChunks(ref.metadataId);
    
    // Update last accessed time
    await this.updateLastAccessed(ref.metadataId);

    return { metadata, chunks };
  }

  /**
   * Get rows from spreadsheet with optional filtering
   */
  async getRows(
    nodeId: NodeId,
    options: {
      startRow?: number;
      endRow?: number;
      filter?: SpreadsheetFilterOptions;
    } = {}
  ): Promise<SpreadsheetRow[]> {
    const data = await this.getSpreadsheetData(nodeId);
    if (!data) return [];

    const { chunks } = data;

    if (options.filter) {
      // Apply filters
      const filterFn = this.createFilterFunction(options.filter);
      return await this.chunkManager.filterRows(chunks, filterFn);
    }

    if (options.startRow !== undefined || options.endRow !== undefined) {
      // Get range
      const startRow = options.startRow || 0;
      const endRow = options.endRow || data.metadata.totalRows - 1;
      return await this.chunkManager.getRowsInRange(chunks, startRow, endRow);
    }

    // Get all rows
    const allRows: SpreadsheetRow[] = [];
    for (const chunk of chunks) {
      const { rows } = await this.chunkManager.extractChunk(chunk);
      allRows.push(...rows);
    }

    return allRows;
  }

  /**
   * Get unique values from a column
   */
  async getColumnValues(
    nodeId: NodeId,
    columnName: string,
    unique = false
  ): Promise<unknown[]> {
    const data = await this.getSpreadsheetData(nodeId);
    if (!data) return [];

    const { chunks } = data;

    if (unique) {
      return await this.chunkManager.getUniqueColumnValues(chunks, columnName);
    }

    return await this.chunkManager.getColumnValues(chunks, columnName);
  }

  /**
   * Import spreadsheet from file
   */
  async importFromFile(
    nodeId: NodeId,
    file: File,
    options: SpreadsheetImportOptions = {}
  ): Promise<SpreadsheetMetadata> {
    const importResult = await this.fileLoader.importFromFile(file, options);
    return await this.createEntity(nodeId, importResult, {
      ...options,
      name: options.name || file.name,
    });
  }

  /**
   * Import spreadsheet from URL
   */
  async importFromURL(
    nodeId: NodeId,
    url: string,
    options: SpreadsheetImportOptions = {}
  ): Promise<SpreadsheetMetadata> {
    const importResult = await this.fileLoader.importFromURL(url, options);
    return await this.createEntity(nodeId, importResult, {
      ...options,
      name: options.name || this.getFilenameFromURL(url),
    });
  }

  /**
   * Import spreadsheet from clipboard
   */
  async importFromClipboard(
    nodeId: NodeId,
    text: string,
    options: SpreadsheetImportOptions = {}
  ): Promise<SpreadsheetMetadata> {
    const importResult = await this.fileLoader.importFromClipboard(text, options);
    return await this.createEntity(nodeId, importResult, {
      ...options,
      name: options.name || 'Clipboard Data',
    });
  }

  /**
   * Delete spreadsheet data
   * LifecycleManagerが自動的に参照カウント管理を行う
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    // PeerEntity削除のみ行う
    // 参照カウント管理はLifecycleManagerが自動実行
    await this.deleteSpreadsheetRef(nodeId);
  }

  /**
   * Private helper methods (these would be implemented by Worker layer)
   */
  private generateMetadataId(): SpreadsheetMetadataId {
    return `spreadsheet-${crypto.randomUUID()}` as SpreadsheetMetadataId;
  }

  private async calculateContentHash(rows: SpreadsheetRow[], headers: string[]): Promise<string> {
    const data = JSON.stringify({ headers, rows });
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private createFilterFunction(filter: SpreadsheetFilterOptions): (row: SpreadsheetRow) => boolean {
    return (row: SpreadsheetRow) => {
      for (const [column, condition] of Object.entries(filter.conditions || {})) {
        const value = row[column];
        
        switch (condition.operator) {
          case 'equals':
            if (value !== condition.value) return false;
            break;
          case 'contains':
            if (!String(value).includes(String(condition.value))) return false;
            break;
          case 'startsWith':
            if (!String(value).startsWith(String(condition.value))) return false;
            break;
          case 'endsWith':
            if (!String(value).endsWith(String(condition.value))) return false;
            break;
          case 'greaterThan':
            if (Number(value) <= Number(condition.value)) return false;
            break;
          case 'lessThan':
            if (Number(value) >= Number(condition.value)) return false;
            break;
          case 'isEmpty':
            if (value !== '' && value != null) return false;
            break;
          case 'isNotEmpty':
            if (value === '' || value == null) return false;
            break;
        }
      }
      return true;
    };
  }

  private getFilenameFromURL(url: string): string {
    return url.split('/').pop() || 'url-data';
  }

  // These methods would be implemented by the Worker layer's database operations
  private async storeMetadata(_metadata: SpreadsheetMetadata): Promise<void> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async storeChunks(_chunks: SpreadsheetChunk[]): Promise<void> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async storeSpreadsheetRef(_ref: SpreadsheetRefEntity): Promise<void> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async getSpreadsheetRef(_nodeId: NodeId): Promise<SpreadsheetRefEntity | null> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async getMetadata(_metadataId: SpreadsheetMetadataId): Promise<SpreadsheetMetadata | null> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async getChunks(_metadataId: SpreadsheetMetadataId): Promise<SpreadsheetChunk[]> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async findByContentHash(_contentHash: string): Promise<SpreadsheetMetadata | null> {
    // contentHash管理はプラグイン側の責務
    // 実装例（実際のDBアクセスはWorker層で実装）
    throw new Error('To be implemented: search SpreadsheetMetadata by contentHash');
  }



  private async deleteSpreadsheetMetadata(_metadataId: SpreadsheetMetadataId): Promise<void> {
    // RelationalEntity削除はプラグイン側の責務
    throw new Error('To be implemented: delete SpreadsheetMetadata');
  }

  private async deleteSpreadsheetChunks(_metadataId: SpreadsheetMetadataId): Promise<void> {
    // 関連データ削除はプラグイン側の責務
    throw new Error('To be implemented: delete SpreadsheetChunks');
  }

  private async updateLastAccessed(_metadataId: SpreadsheetMetadataId): Promise<void> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async deleteSpreadsheetRef(_nodeId: NodeId): Promise<void> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async countSpreadsheetRefsByMetadata(_metadataId: SpreadsheetMetadataId): Promise<number> {
    throw new Error('Not implemented - should be handled by Worker');
  }
}