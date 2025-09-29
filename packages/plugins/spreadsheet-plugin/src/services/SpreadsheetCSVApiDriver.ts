/**
 * @file SpreadsheetCSVApiDriver.ts
 * @description CSV data processing API driver for Spreadsheet plugin
 * Refactored from StylerCSVApiDriver with chunking support for large tables
 */

import type {
  CSVColumnInfo,
  CSVDataResult,
  CSVFilterRule,
  CSVProcessingConfig,
  CSVSelectionConfig,
  CSVTableListResult,
  CSVTableMetadata,
  ICSVDataApi,
  PaginationOptions,
} from '@hierarchidb/ui-csv-extract';

import { SimpleTableMetadataManager } from './SimpleTableMetadataManager.js';
import { SpreadsheetDatabase } from '../database/SpreadsheetDatabase.js';
import { calculateFileHash } from '../utils/hashUtils.js';
import { detectColumnTypes, parseCSVContent } from '../utils/csvParser.js';
import { processExcelFile, processZipFile } from '../utils/fileProcessingUtils.js';
import { applyCsvFilters } from '../utils/filterUtils.js';

// Chunk configuration for large table support
interface ChunkConfig {
  maxRowsPerChunk: number;
  maxMemoryUsage: number; // in bytes
  enableVirtualization: boolean;
}

interface ChunkedData {
  chunks: Array<Array<Record<string, string | number | null>>>;
  totalRows: number;
  chunkSize: number;
}

type MetadataInput = Partial<CSVTableMetadata> & {
  id?: string;
  columns?: CSVColumnInfo[];
  totalColumns?: number;
};

export class SpreadsheetCSVApiDriver implements ICSVDataApi {
  private tableManager: SimpleTableMetadataManager;
  private csvDataStorage = new Map<string, ChunkedData>();
  private spreadsheetDB: SpreadsheetDatabase | null = null;
  private pluginId: string;

  private readonly chunkConfig: ChunkConfig = {
    maxRowsPerChunk: 10000, // 10K rows per chunk
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB memory limit
    enableVirtualization: true,
  };

  /**
      * :
   * : SpreadsheetStyler
   * :
      */
  constructor(pluginIdOrTableManager: string | SimpleTableMetadataManager = 'spreadsheet') {
    if (typeof pluginIdOrTableManager === 'string') {
      //  Spreadsheet mode:
      this.pluginId = pluginIdOrTableManager;
      this.tableManager = new SimpleTableMetadataManager();
      this.spreadsheetDB = new SpreadsheetDatabase();
    } else {
      //  Styler mode:
      this.pluginId = 'styler';
      this.tableManager = pluginIdOrTableManager;
      this.spreadsheetDB = null; //  StylerSpreadsheetDB
    }

    // Ensure private helpers are treated as used for strict noUnused* settings
    // without altering runtime behavior.
    // These helpers are wired in larger flows during full feature enablement.
    // helpers are now wired into the flow via upload/download paths
  }

  /**
      * : CSV
   * : Styler
   * : CSV100K
   * :
      */
  async uploadCSVFile(file: File, config: CSVProcessingConfig = {}): Promise<CSVTableMetadata> {
    try {
      // Validate and hash
      await this.validateFile(file);
      const contentHash = await calculateFileHash(file);
      // Process file (detect delimiter etc.) and parse with chunking
      const { content, detectedConfig } = await this.processFile(file, config);
      const { chunkedData, columns } = await this.parseCSVWithChunking(content, {
        ...config,
        ...detectedConfig,
      });
      const normalizedColumns: CSVColumnInfo[] = columns.map((column, index) => ({
        ...column,
        index,
        sampleValues: (column.sampleValues ?? []).slice(0, 5),
      }));

      const tableId = crypto.randomUUID();
      const metadata: CSVTableMetadata = {
        id: tableId,
        filename: file.name,
        columns: normalizedColumns,
        totalRows: chunkedData.totalRows,
        contentHash,
        createdAt: Date.now(),
        fileSizeBytes: file.size,
        referencingPlugins: [],
        referenceCount: 0,
        isChunked: chunkedData.totalRows > chunkedData.chunkSize,
        chunkCount: Math.max(1, Math.ceil(chunkedData.totalRows / chunkedData.chunkSize)),
      };

      this.storeChunkedData(tableId, chunkedData);

      if (this.spreadsheetDB) {
        await this.saveToSpreadsheetDB(file, contentHash, chunkedData, config, config);
      }

      await this.tableManager.create(metadata, this.pluginId);
      return metadata;
    } catch (error) {
      throw new Error(`CSV upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
      * : URLCSV
   * : StylerSSRF
   * : URL
   * :
      */
  async downloadCSVFromUrl(
    url: string,
    config: CSVProcessingConfig = {},
  ): Promise<CSVTableMetadata> {
    try {
      //  : URLSSRF

      //  : fetch API
      const { authFetch } = await import('./utils/authFetch.js');
      const response = await authFetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/csv, application/csv, text/plain, application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      //  : Content-Type
      const contentType = response.headers.get('content-type') || '';
      const filename = url.split('/').pop() || 'downloaded.csv';

      //  : ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      const file = new File([arrayBuffer], filename, { type: contentType });

      //  : uploadCSVFile
      return await this.uploadCSVFile(file, config);
    } catch (error) {
      throw new Error(
        `CSV download failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
      * :
   * :
   * :
   * :
      */
  async getFilteredPreview(
    tableId: string,
    filters: CSVFilterRule[],
    rowCount: number,
    startRow: number = 0,
  ): Promise<CSVDataResult> {
    //  :
    const metadata = await this.tableManager.get(tableId);
    if (!metadata) {
      throw new Error('Table not found');
    }

    //  :
    const chunkedData = this.getStoredChunkedData(tableId);
    if (!chunkedData) {
      throw new Error('CSV data not found for table');
    }

    //  :
    const { filteredRows, totalFilteredRows } = await this.processChunksWithFilter(
      chunkedData,
      filters,
      rowCount,
      startRow,
    );

    //  : CSVDataResult
    return {
      columns: this.ensureColumnsFromMetadata(metadata, []),
      rows: filteredRows,
      totalRows: totalFilteredRows,
      // Chunking information
      isChunked: metadata.isChunked || false,
      chunkInfo: metadata.isChunked ? {
        currentChunk: Math.floor(startRow / 10000) + 1,
        totalChunks: metadata.chunkCount || 1,
        chunkSize: 10000,
      } : undefined,
    };
  }

  /**
      * :
   * : getFilteredPreview
   * : CSVSelectionConfig
   * :
      */
  async getFilteredData(tableId: string, selection: CSVSelectionConfig): Promise<CSVDataResult> {
    //  selectionfilterRulesgetFilteredPreview
    const filters = selection.filterRules || [];

    return await this.getFilteredPreview(tableId, filters, Number.MAX_SAFE_INTEGER, 0);
  }

  /**
      * :
   * : SimpleTableMetadataManager
   * :
   * :
      */
  async listTables(
    _pluginId?: string,
    pagination?: PaginationOptions,
  ): Promise<CSVTableListResult> {
    const tables = await this.tableManager.list();

    // Apply pagination if provided
    let result = tables;
    if (pagination) {
      result = tables.slice(pagination.offset, pagination.offset + pagination.limit);
    }

    return {
      tables: result.map((m) => this.ensureFullMetadata(m)),
      total: tables.length,
    };
  }

  /**
      * :
   * :
   * : 0
   * :
      */
  async deleteTable(tableId: string): Promise<void> {
    //  :
    const shouldDelete =
      'removeReference' in this.tableManager
        ? await this.tableManager.removeReference(tableId, this.pluginId)
        : false; //  Styler

    if (shouldDelete || !('removeReference' in this.tableManager)) {
      //  :
      this.csvDataStorage.delete(tableId);

      //  Styler
      if (!('removeReference' in this.tableManager)) {
        // Type cast to ensure TypeScript knows forceDelete exists
        const manager = this.tableManager as SimpleTableMetadataManager;
        if (typeof manager.forceDelete === 'function') {
          await manager.forceDelete(tableId);
        } else {
          await manager.removeReference(tableId, this.pluginId);
        }
      }
    }
  }

  /**
      * : SpreadsheetDB
   * :
   * : Hash-based Data Reuse
   * :
      */
  async getStatistics(): Promise<
    | {
    totalFiles: number;
    totalChunks: number;
    totalEntities: number;
    totalDataSize: number;
    averageRowsPerFile: number;
  }
    | undefined
  > {
    if (!this.spreadsheetDB) {
      return undefined;
    }

    //  SpreadsheetDatabase/
    const raw = await this.spreadsheetDB.getStatistics?.();
    if (!raw) return undefined;

    const {
      totalFiles = 0,
      totalChunks = 0,
      totalEntities = 0,
      totalDataSize = 0,
      averageRowsPerFile = 0,
    } = raw;

    return { totalFiles, totalChunks, totalEntities, totalDataSize, averageRowsPerFile };
  }

  /**
      * :
   * : Styler
   * :
   * : Styler
      */
  async addTableReference(tableId: string, pluginId: string): Promise<void> {
    if ('addReference' in this.tableManager) {
      await this.tableManager.addReference(tableId, pluginId);
    } else {
      throw new Error('Reference management not supported in this mode');
    }
  }

  /**
      * :
   * : Styler
   * :
   * : Styler
      */
  async removeTableReference(tableId: string, pluginId: string): Promise<void> {
    if ('removeReference' in this.tableManager) {
      await this.tableManager.removeReference(tableId, pluginId);
    } else {
      throw new Error('Reference management not supported in this mode');
    }
  }

  /**
      * :
   * : Styler
   * :
   * : Styler
      */
  async getTableMetadata(tableId: string): Promise<CSVTableMetadata | null> {
    const metadata = await this.tableManager.get(tableId);
    return metadata ? this.ensureFullMetadata(metadata) : null;
  }

  private ensureFullMetadata(m: MetadataInput): CSVTableMetadata {
    const id = typeof m.id === 'string' && m.id.length > 0 ? m.id : crypto.randomUUID();
    const baseColumns = this.ensureColumnsFromMetadata({ ...m, id }, []);
    return {
      id,
      filename: m.filename ?? '',
      fileUrl: m.fileUrl,
      contentHash: m.contentHash ?? '',
      fileSizeBytes: m.fileSizeBytes ?? 0,
      totalRows: m.totalRows ?? 0,
      columns: baseColumns,
      createdAt: m.createdAt ?? Date.now(),
      updatedAt: m.updatedAt,
      referenceCount:
        m.referenceCount ?? (Array.isArray(m.referencingPlugins) ? m.referencingPlugins.length : 0),
      referencingPlugins: m.referencingPlugins ?? [],
      isChunked: m.isChunked,
      chunkCount: m.chunkCount,
    };
  }

  /**
      * : CSV
   * :
   * :
   * :
      */
  private async parseCSVWithChunking(
    content: string,
    config: CSVProcessingConfig,
  ): Promise<{ chunkedData: ChunkedData; columns: CSVColumnInfo[] }> {
    //  : CSV
    const { rows, columns } = await parseCSVContent(content, config);

    //  :
    const typedColumns = detectColumnTypes(
      columns.map((c) => c.name),
      rows,
    );
    const columnInfo: CSVColumnInfo[] = typedColumns.map((col, index) => {
      const columnValues = rows.map((row) => row[col.name]).filter((v) => v != null);
      const uniqueValues = new Set(columnValues).size;
      const hasNullValues = rows.some((row) => row[col.name] == null);
      const sampleValues = columnValues
        .slice(0, 5)
        .map((v) => (typeof v === 'string' || typeof v === 'number' ? v : String(v)));

      return {
        name: col.name,
        index: index,
        type: col.type,
        uniqueValues: uniqueValues,
        hasNullValues: hasNullValues,
        sampleValues: sampleValues,
      };
    });

    //  :
    const shouldChunk = this.shouldUseChunking(rows.length, content.length);

    if (!shouldChunk) {
      //  :
      return {
        chunkedData: {
          chunks: [rows],
          totalRows: rows.length,
          chunkSize: rows.length,
        },
        columns: columnInfo,
      };
    }

    //  :
    const chunks: Array<Array<Record<string, string | number | null>>> = [];
    const chunkSize = this.chunkConfig.maxRowsPerChunk;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    return {
      chunkedData: {
        chunks,
        totalRows: rows.length,
        chunkSize,
      },
      columns: columnInfo,
    };
  }

  /**
      * :
   * : Styler
   * :
   * :
      */
  private async processFile(
    file: File,
    config: CSVProcessingConfig,
  ): Promise<{ content: string; detectedConfig: Partial<CSVProcessingConfig> }> {
    const fileExtension = file.name.includes('.')
      ? '.' + file.name.split('.').pop()!.toLowerCase()
      : '';

    switch (fileExtension) {
      case '.xlsx':
      case '.xls':
        return await processExcelFile(file, config);

      case '.zip':
        return await processZipFile(file, config);

      case '.csv':
      case '.tsv':
      case '.txt':
      default:
        return {
          content: await file.text(),
          detectedConfig: {
            delimiter: fileExtension === '.tsv' ? '\t' : config.delimiter || ',',
          },
        };
    }
  }

  /**
      * :
   * :
   * :
      */
  private storeChunkedData(tableId: string, chunkedData: ChunkedData): void {
    this.csvDataStorage.set(tableId, chunkedData);
  }

  /**
      * :
   * :
      */
  private getStoredChunkedData(tableId: string): ChunkedData | undefined {
    return this.csvDataStorage.get(tableId);
  }

  /**
      * :
   * :
   * :
      */
  private shouldUseChunking(rowCount: number, contentSize: number): boolean {
    return (
      rowCount > this.chunkConfig.maxRowsPerChunk || contentSize > this.chunkConfig.maxMemoryUsage
    );
  }

  /**
      * :
   * :
   * :
      */
  private async processChunksWithFilter(
    chunkedData: ChunkedData,
    filters: CSVFilterRule[],
    rowCount: number,
    startRow: number,
  ): Promise<{ filteredRows: Array<Record<string, any>>; totalFilteredRows: number }> {
    const filteredRows: Array<Record<string, any>> = [];
    let totalFilteredRows = 0;
    let currentRow = 0;

    //  :
    for (const chunk of chunkedData.chunks) {
      //  :
      const filteredChunk = applyCsvFilters(chunk || [], filters);

      //  :
      for (const row of filteredChunk) {
        if (currentRow >= startRow && filteredRows.length < rowCount) {
          filteredRows.push(row);
        }
        currentRow++;
        totalFilteredRows++;

        //  :
        if (filteredRows.length >= rowCount) {
          break;
        }
      }

      //  :
      if (filteredRows.length >= rowCount) {
        //  totalFilteredRows
        for (let i = chunkedData.chunks.indexOf(chunk) + 1; i < chunkedData.chunks.length; i++) {
          const remainingFilteredChunk = applyCsvFilters(chunkedData.chunks[i] || [], filters);
          totalFilteredRows += remainingFilteredChunk.length;
        }
        break;
      }
    }

    return { filteredRows, totalFilteredRows };
  }

  /**
      * : RawFileMetadata
   * : CSVColumnInfo
   * :
      */
  private reconstructColumnsFromMetadata(metadata: MetadataInput): CSVColumnInfo[] {
    //  :
    if (metadata.columns) {
      return metadata.columns;
    }

    //  :
    const columnCount = metadata.totalColumns || 0;
    const columns: CSVColumnInfo[] = [];

    for (let i = 0; i < columnCount; i++) {
      columns.push({
        name: `Column${i + 1}`,
        index: i,
        type: 'string' as const,
        uniqueValues: 0,
        hasNullValues: false,
        sampleValues: [],
      });
    }

    return columns;
  }

  /**
   * Small wrapper to use column reconstruction where metadata columns are missing.
   */
  private ensureColumnsFromMetadata(metadata: MetadataInput | null | undefined, fallback: CSVColumnInfo[]): CSVColumnInfo[] {
    if (!metadata || !Array.isArray(metadata.columns) || metadata.columns.length === 0) {
      return this.reconstructColumnsFromMetadata({
        id: metadata?.id ?? crypto.randomUUID(),
        totalColumns: fallback.length,
      });
    }
    return metadata.columns;
  }

  /**
      * :
   * : Styler
   * :
      */
  private async validateFile(file: File): Promise<void> {
    //  : 100MB
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      throw new Error(
        `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxSize / 1024 / 1024)}MB)`,
      );
    }

    //  :
    const supportedExtensions = ['.csv', '.tsv', '.txt', '.xlsx', '.xls', '.zip'];
    const fileExtension = file.name.includes('.')
      ? '.' + file.name.split('.').pop()!.toLowerCase()
      : '';

    if (!supportedExtensions.includes(fileExtension)) {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  }

  /**
      * : SpreadsheetDatabase
   * : RawFileMetadata + RowChunks
   * : SpreadsheetCSVApiDriverDexie
   * : EntityIDDexie
      */
  private async saveToSpreadsheetDB(
    file: File,
    contentHash: string,
    chunkedData: ChunkedData,
    config: CSVProcessingConfig,
    detectedConfig: CSVProcessingConfig,
  ): Promise<void> {
    //  RawFileMetadata:
    const rawFileMetadata = await this.spreadsheetDB!.createRawFileMetadata({
      fileName: file.name,
      fileSize: file.size,
      contentHash: contentHash,
      mimeType: file.type || 'text/csv',
      encoding: config.encoding || detectedConfig.encoding || 'utf-8',
      parsingConfig: {
        delimiter: config.delimiter || detectedConfig.delimiter || ',',
        quoteChar: config.quoteChar || '"',
        escapeChar: config.escapeChar || '\\',
        hasHeader: config.hasHeader !== undefined ? config.hasHeader : true,
        skipEmptyLines: config.skipEmptyLines !== undefined ? config.skipEmptyLines : true,
      },
      totalRows: chunkedData.totalRows,
      totalColumns:
        chunkedData.chunks.length > 0 && chunkedData.chunks[0]?.[0]
          ? Object.keys(chunkedData.chunks[0][0]).length
          : 0,
      chunkCount: chunkedData.chunks.length,
    });

    // 【RowChunks作成】: チャンクデータの保存 🟢
    for (let chunkIndex = 0; chunkIndex < chunkedData.chunks.length; chunkIndex++) {
      const chunk = chunkedData.chunks[chunkIndex];
      if (!chunk) continue; // Skip if chunk is undefined
      const startRowIndex = chunkIndex * chunkedData.chunkSize;
      const endRowIndex = startRowIndex + chunk.length - 1;

      // 【バイナリ化】: チャンクデータをバイナリ形式で保存 🟡
      const jsonString = JSON.stringify(chunk);
      const encoder = new TextEncoder();
      const binaryData = encoder.encode(jsonString).buffer;

      await this.spreadsheetDB!.createRowChunk({
        rawFileMetadataId: rawFileMetadata.id,
        chunkIndex: chunkIndex,
        binaryData: binaryData,
        rowCount: chunk.length,
        startRowIndex: startRowIndex,
        endRowIndex: endRowIndex,
        compressedSize: binaryData.byteLength,
        originalSize: jsonString.length,
      });
    }
  }
}
