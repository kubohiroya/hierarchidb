import Dexie, { type Table } from 'dexie';
// Local type definitions for SpreadsheetDB (plugin types not available in worker)
export type SpreadsheetMetadataId = string & { readonly __brand: 'SpreadsheetMetadataId' };

export interface SpreadsheetMetadata {
  id: SpreadsheetMetadataId;
  name: string;
  description?: string;
  contentHash: string;
  columns: string[];
  rowCount: number;
  totalRows: number;
  totalChunks: number;
  columnCount: number;
  fileSize: number;
  originalFormat: 'csv' | 'tsv' | 'excel' | 'json';
  delimiter: string;
  hasHeader: boolean;
  encoding: string;
  stats?: {
    numericColumns: string[];
    dateColumns: string[];
    textColumns: string[];
  };
  referenceCount?: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  version: number;
}

export interface SpreadsheetChunk {
  id: string;
  metadataId: SpreadsheetMetadataId;
  chunkIndex: number;
  compressedData: Uint8Array;
  rowStart: number;
  rowEnd: number;
  sizeBytes: number;
  firstRowPreview?: string;
  startRowIndex: number;
  endRowIndex: number;
  compressedSize: number;
  uncompressedSize: number;
  contentHash: string;
  lastAccessedAt: number;
}

export interface SpreadsheetRefEntity {
  nodeId: NodeId;
  metadataId: SpreadsheetMetadataId;
  createdAt: number;
  updatedAt: number;
  version: number;
}
import type { NodeId } from '@hierarchidb/00-core';

/**
 * SpreadsheetDB - 独立したスプレッドシート専用データベース
 * プラグインが自分で管理する独立したDexieデータベース
 */
export class SpreadsheetDB extends Dexie {
  // RelationalEntity tables
  spreadsheetMetadata!: Table<SpreadsheetMetadata, SpreadsheetMetadataId>;
  spreadsheetChunks!: Table<SpreadsheetChunk, string>;

  // PeerEntity table
  spreadsheetRefs!: Table<SpreadsheetRefEntity, NodeId>;

  constructor(name: string = 'hierarchidb-spreadsheet') {
    super(name);

    this.version(1).stores({
      // RelationalEntity: SpreadsheetMetadata (共有データ)
      spreadsheetMetadata: '&id, contentHash, createdAt, lastAccessedAt, rowCount',
      
      // RelationalEntity: SpreadsheetChunk (チャンクデータ)  
      spreadsheetChunks: '&id, metadataId, [metadataId+chunkIndex], rowStart, rowEnd',
      
      // PeerEntity: SpreadsheetRefEntity (ノード紐付け)
      spreadsheetRefs: '&nodeId, metadataId, createdAt, updatedAt'
    });
  }

  /**
   * データベース初期化
   */
  async initialize(): Promise<void> {
    console.log('SpreadsheetDB initialized');
  }

  /**
   * SpreadsheetMetadata operations
   */
  async createMetadata(metadata: SpreadsheetMetadata): Promise<void> {
    await this.spreadsheetMetadata.add(metadata);
  }

  async getMetadata(id: SpreadsheetMetadataId): Promise<SpreadsheetMetadata | undefined> {
    return await this.spreadsheetMetadata.get(id);
  }

  async findMetadataByContentHash(contentHash: string): Promise<SpreadsheetMetadata | undefined> {
    return await this.spreadsheetMetadata.where('contentHash').equals(contentHash).first();
  }

  async updateLastAccessed(id: SpreadsheetMetadataId): Promise<void> {
    await this.spreadsheetMetadata.update(id, {
      lastAccessedAt: Date.now()
    });
  }

  async deleteMetadata(id: SpreadsheetMetadataId): Promise<void> {
    await this.spreadsheetMetadata.delete(id);
  }

  /**
   * SpreadsheetChunk operations
   */
  async createChunks(chunks: SpreadsheetChunk[]): Promise<void> {
    await this.spreadsheetChunks.bulkAdd(chunks);
  }

  async getChunks(metadataId: SpreadsheetMetadataId): Promise<SpreadsheetChunk[]> {
    return await this.spreadsheetChunks.where('metadataId').equals(metadataId).toArray();
  }

  async deleteChunks(metadataId: SpreadsheetMetadataId): Promise<void> {
    await this.spreadsheetChunks.where('metadataId').equals(metadataId).delete();
  }

  /**
   * SpreadsheetRefEntity operations (PeerEntity)
   */
  async createRef(ref: SpreadsheetRefEntity): Promise<void> {
    await this.spreadsheetRefs.add(ref);
  }

  async getRef(nodeId: NodeId): Promise<SpreadsheetRefEntity | undefined> {
    return await this.spreadsheetRefs.get(nodeId);
  }

  async updateRef(nodeId: NodeId, updates: Partial<SpreadsheetRefEntity>): Promise<void> {
    await this.spreadsheetRefs.update(nodeId, {
      ...updates,
      updatedAt: Date.now()
    });
  }

  async deleteRef(nodeId: NodeId): Promise<void> {
    await this.spreadsheetRefs.delete(nodeId);
  }

  /**
   * 参照カウント管理 (自然な参照カウント)
   */
  async countRefsForMetadata(metadataId: SpreadsheetMetadataId): Promise<number> {
    return await this.spreadsheetRefs.where('metadataId').equals(metadataId).count();
  }

  async getRefsForMetadata(metadataId: SpreadsheetMetadataId): Promise<SpreadsheetRefEntity[]> {
    return await this.spreadsheetRefs.where('metadataId').equals(metadataId).toArray();
  }

  /**
   * クリーンアップ - 参照されていないRelationalEntityを削除
   */
  async cleanup(): Promise<{ deletedMetadata: number; deletedChunks: number }> {
    const allMetadata = await this.spreadsheetMetadata.toArray();
    let deletedMetadata = 0;
    let deletedChunks = 0;

    for (const metadata of allMetadata) {
      const refCount = await this.countRefsForMetadata(metadata.id);
      if (refCount === 0) {
        await this.deleteMetadata(metadata.id);
        await this.deleteChunks(metadata.id);
        deletedMetadata++;
        deletedChunks += await this.spreadsheetChunks.where('metadataId').equals(metadata.id).count();
      }
    }

    return { deletedMetadata, deletedChunks };
  }

  /**
   * 統計情報取得
   */
  async getStats(): Promise<{
    totalMetadata: number;
    totalChunks: number;
    totalRefs: number;
    orphanedMetadata: number;
  }> {
    const totalMetadata = await this.spreadsheetMetadata.count();
    const totalChunks = await this.spreadsheetChunks.count();
    const totalRefs = await this.spreadsheetRefs.count();

    // 孤立したメタデータをカウント
    const allMetadata = await this.spreadsheetMetadata.toArray();
    let orphanedMetadata = 0;
    for (const metadata of allMetadata) {
      const refCount = await this.countRefsForMetadata(metadata.id);
      if (refCount === 0) {
        orphanedMetadata++;
      }
    }

    return {
      totalMetadata,
      totalChunks,
      totalRefs,
      orphanedMetadata
    };
  }
}