import * as pako from 'pako';
import type {
  SpreadsheetMetadataId,
  SpreadsheetChunk,
  SpreadsheetChunkId,
  SpreadsheetRow,
} from '~/entities/types';

/**
 * ChunkManager handles chunking, compression, and storage of spreadsheet data
 */
export class ChunkManager {
  private static readonly CHUNK_SIZE = 100000; // 100K rows per chunk
  private static readonly COMPRESSION_LEVEL = 6; // gzip compression level

  /**
   * Split rows into chunks and compress them
   */
  async createChunks(
    metadataId: SpreadsheetMetadataId,
    rows: SpreadsheetRow[],
    headers: string[]
  ): Promise<SpreadsheetChunk[]> {
    const chunks: SpreadsheetChunk[] = [];
    const totalChunks = Math.ceil(rows.length / ChunkManager.CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const startIndex = i * ChunkManager.CHUNK_SIZE;
      const endIndex = Math.min(startIndex + ChunkManager.CHUNK_SIZE, rows.length);
      const chunkRows = rows.slice(startIndex, endIndex);

      const chunk = await this.createChunk(
        metadataId,
        i,
        chunkRows,
        headers,
        startIndex,
        endIndex - 1
      );

      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Create a single compressed chunk
   */
  private async createChunk(
    metadataId: SpreadsheetMetadataId,
    chunkIndex: number,
    rows: SpreadsheetRow[],
    headers: string[],
    startRowIndex: number,
    endRowIndex: number
  ): Promise<SpreadsheetChunk> {
    // Prepare data for compression
    const chunkData = {
      headers,
      rows,
      metadata: {
        chunkIndex,
        startRowIndex,
        endRowIndex,
        rowCount: rows.length,
      },
    };

    // Convert to JSON and compress
    const jsonString = JSON.stringify(chunkData);
    const compressedData = pako.gzip(jsonString, {
      level: ChunkManager.COMPRESSION_LEVEL,
    });

    // Calculate content hash
    const contentHash = await this.calculateHash(compressedData);

    const chunkId = this.generateChunkId(metadataId, chunkIndex);

    return {
      id: chunkId,
      metadataId,
      chunkIndex,
      rowStart: startRowIndex,
      rowEnd: endRowIndex,
      sizeBytes: compressedData.length,
      startRowIndex,
      endRowIndex,
      compressedData: compressedData,
      compressedSize: compressedData.length,
      uncompressedSize: jsonString.length,
      contentHash,
      lastAccessedAt: Date.now(),
    };
  }

  /**
   * Decompress and extract rows from a chunk
   */
  async extractChunk(chunk: SpreadsheetChunk): Promise<{
    headers: string[];
    rows: SpreadsheetRow[];
  }> {
    try {
      // Decompress data
      const compressedData = new Uint8Array(chunk.compressedData);
      const decompressedData = pako.ungzip(compressedData, { to: 'string' });

      // Parse JSON
      const chunkData = JSON.parse(decompressedData);

      // Validate structure
      if (!chunkData.headers || !chunkData.rows) {
        throw new Error('Invalid chunk data structure');
      }

      // Update last accessed time (this would be persisted by the caller)
      chunk.lastAccessedAt = Date.now();

      return {
        headers: chunkData.headers,
        rows: chunkData.rows,
      };
    } catch (error) {
      throw new Error(`Failed to extract chunk ${chunk.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get rows from a range across multiple chunks
   */
  async getRowsInRange(
    chunks: SpreadsheetChunk[],
    startRow: number,
    endRow: number
  ): Promise<SpreadsheetRow[]> {
    const relevantChunks = chunks.filter(chunk =>
      chunk.startRowIndex <= endRow && chunk.endRowIndex >= startRow
    );

    const allRows: SpreadsheetRow[] = [];

    for (const chunk of relevantChunks) {
      const { rows } = await this.extractChunk(chunk);
      
      // Calculate the slice boundaries within this chunk
      const chunkStartRow = Math.max(0, startRow - chunk.startRowIndex);
      const chunkEndRow = Math.min(rows.length - 1, endRow - chunk.startRowIndex);

      if (chunkStartRow <= chunkEndRow) {
        const slicedRows = rows.slice(chunkStartRow, chunkEndRow + 1);
        allRows.push(...slicedRows);
      }
    }

    return allRows;
  }

  /**
   * Apply filters to chunks and return matching rows
   */
  async filterRows(
    chunks: SpreadsheetChunk[],
    filterFn: (row: SpreadsheetRow) => boolean
  ): Promise<SpreadsheetRow[]> {
    const matchingRows: SpreadsheetRow[] = [];

    for (const chunk of chunks) {
      const { rows } = await this.extractChunk(chunk);
      const filteredRows = rows.filter(filterFn);
      matchingRows.push(...filteredRows);
    }

    return matchingRows;
  }

  /**
   * Get column values from all chunks
   */
  async getColumnValues(
    chunks: SpreadsheetChunk[],
    columnName: string
  ): Promise<unknown[]> {
    const values: unknown[] = [];

    for (const chunk of chunks) {
      const { rows } = await this.extractChunk(chunk);
      const columnValues = rows.map(row => row[columnName]);
      values.push(...columnValues);
    }

    return values;
  }

  /**
   * Get unique values from a column across all chunks
   */
  async getUniqueColumnValues(
    chunks: SpreadsheetChunk[],
    columnName: string
  ): Promise<unknown[]> {
    const allValues = await this.getColumnValues(chunks, columnName);
    return Array.from(new Set(allValues));
  }

  /**
   * Calculate compression ratio
   */
  getCompressionRatio(chunk: SpreadsheetChunk): number {
    return chunk.compressedSize / chunk.uncompressedSize;
  }

  /**
   * Get total size of all chunks
   */
  getTotalSize(chunks: SpreadsheetChunk[]): {
    compressed: number;
    uncompressed: number;
    ratio: number;
  } {
    const compressed = chunks.reduce((sum, chunk) => sum + chunk.compressedSize, 0);
    const uncompressed = chunks.reduce((sum, chunk) => sum + chunk.uncompressedSize, 0);
    
    return {
      compressed,
      uncompressed,
      ratio: uncompressed > 0 ? compressed / uncompressed : 0,
    };
  }

  /**
   * Validate chunk integrity
   */
  async validateChunk(chunk: SpreadsheetChunk): Promise<boolean> {
    try {
      // Verify hash
      const compressedData = new Uint8Array(chunk.compressedData);
      const calculatedHash = await this.calculateHash(compressedData);
      
      if (calculatedHash !== chunk.contentHash) {
        return false;
      }

      // Try to decompress
      await this.extractChunk(chunk);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate chunk ID
   */
  private generateChunkId(metadataId: SpreadsheetMetadataId, chunkIndex: number): SpreadsheetChunkId {
    return `${metadataId}-chunk-${chunkIndex.toString().padStart(6, '0')}` as SpreadsheetChunkId;
  }

  /**
   * Calculate SHA-256 hash
   */
  private async calculateHash(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Export singleton instance
export const chunkManager = new ChunkManager();