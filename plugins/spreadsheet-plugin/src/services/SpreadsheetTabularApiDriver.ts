import type {
  TabularDataResult,
  TabularFilterRule,
  TabularProcessingConfig,
  TabularSelectionConfig,
  TabularTableListResult,
  PaginationOptions,
  TabularDataApi,
} from '@hierarchidb/ui-tabular';
import {
  getRowStoreDB,
  type SimpleTableMetadataManager,
  type TabularTableMetadata,
  type TabularTableMetadataLike,
} from '@hierarchidb/tabular-store';
import { TabularService } from '@hierarchidb/tabular-source';
import { DexieChunkStore } from '@hierarchidb/chunk-store';
import { FetchNetworkPort } from '@hierarchidb/download';
import type { NodeId } from '@hierarchidb/common-types';
import { toNodeId } from '@hierarchidb/common-types';
import { getDBName } from '@hierarchidb/util';
import { SpreadsheetMetadataManager } from './SpreadsheetMetadataManager.js';
import { SpreadsheetStorePort } from './SpreadsheetStorePort.js';
import { hashFile } from './utils/hash.js';
import { matchesFilters, normalizeValueForResult, prepareFilters, type PreparedFilter, type TabularRow } from './utils/filtering.js';
import { SPREADSHEET_PLUGIN_ID } from '../common/constants.js';

type RowChunkLike = {
  binaryData: ArrayBuffer;
};

const chunkDecoder = new TextDecoder();

const decodeChunkRows = (chunk: RowChunkLike): TabularRow[] => {
  try {
    const json = chunkDecoder.decode(new Uint8Array(chunk.binaryData));
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as TabularRow[]) : [];
  } catch {
    return [];
  }
};

const DEFAULT_TABULAR_NODE_ID = 'spreadsheet-shared' as NodeId;

const buildCacheKey = (pluginId: string, url: string): string => (
  `${pluginId}:${hashString(url)}`
);

const hashString = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
};

export class SpreadsheetTabularApiDriver implements TabularDataApi {
  private readonly pluginId: string;
  private readonly metadataManager: SimpleTableMetadataManager;
  private readonly tabularService = new TabularService();
  private downloadStore: DexieChunkStore<ArrayBuffer> | null = null;
  private networkPort: FetchNetworkPort | null = null;

  constructor(pluginIdOrManager: string | SimpleTableMetadataManager = SPREADSHEET_PLUGIN_ID, pluginIdOverride?: string) {
    if (typeof pluginIdOrManager === 'string') {
      this.pluginId = pluginIdOrManager;
      this.metadataManager = new SpreadsheetMetadataManager();
    } else {
      this.metadataManager = pluginIdOrManager;
      this.pluginId = pluginIdOverride ?? SPREADSHEET_PLUGIN_ID;
    }
  }

  async uploadTabularFile(file: File, config: TabularProcessingConfig = {}): Promise<TabularTableMetadata> {
    const contentHash = await hashFile(file);
    const existing = await this.metadataManager.findByContentHash(contentHash);
    if (existing) {
      await this.metadataManager.addReference(existing.id, this.pluginId);
      return this.toMetadata(existing);
    }

    const store = new SpreadsheetStorePort({
      pluginId: this.pluginId,
      metadataManager: this.metadataManager as SpreadsheetMetadataManager,
      filename: file.name,
      fileSizeBytes: file.size,
      contentHash,
    });

    const parseOptions = this.toParseOptions(config);
    const ingestSource = await this.resolveIngestSource(file);
    const result = await this.tabularService.ingest(ingestSource, store, {
      filename: file.name,
      sizeBytes: file.size,
      ...parseOptions,
    });
    return this.toMetadata(result.metadata);
  }

  async uploadCSVFile(file: File, config: TabularProcessingConfig = {}): Promise<TabularTableMetadata> {
    return this.uploadTabularFile(file, config);
  }

  async downloadTabularFromUrl(
    url: string,
    config: TabularProcessingConfig = {},
    nodeId?: string,
  ): Promise<TabularTableMetadata> {
    try {
      const resolvedNodeId = nodeId ? toNodeId(nodeId) : DEFAULT_TABULAR_NODE_ID;
      const entry = await this.getDownloadStore().getOrFetchForNode(resolvedNodeId, url, {
        accept: 'text/csv',
        cacheKey: buildCacheKey(this.pluginId, url),
      });
      const buffer = entry.value;
      const contentType = entry.metadata?.contentType ?? 'text/csv';
      const filename = this.deriveFilename(url);
      const file = new File([buffer], filename, {
        type: contentType,
      });
      return await this.uploadTabularFile(file, config);
    } catch (error) {
      if (error instanceof Error) {
        if (/^HTTP\s+\d+/.test(error.message)) {
          throw new Error(`CSV download failed: ${error.message}`);
        }
        throw error;
      }
      throw new Error(String(error));
    }
  }

  async downloadCSVFromUrl(
    url: string,
    config: TabularProcessingConfig = {},
    nodeId?: string,
  ): Promise<TabularTableMetadata> {
    return this.downloadTabularFromUrl(url, config, nodeId);
  }

  private getDownloadStore(): DexieChunkStore<ArrayBuffer> {
    if (this.downloadStore) return this.downloadStore;
    const networkPort = this.getNetworkPort();
    this.downloadStore = new DexieChunkStore<ArrayBuffer>({
      dbName: getDBName(`${this.pluginId}-chunks`),
      serializer: (value) => value,
      deserializer: (value) => value,
      networkPort,
    });
    return this.downloadStore;
  }

  private getNetworkPort(): FetchNetworkPort {
    if (this.networkPort) return this.networkPort;
    this.networkPort = new FetchNetworkPort({
      perHostConcurrency: 4,
      retries: 0,
      baseDelayMs: 0,
      maxDelayMs: 0,
    });
    return this.networkPort;
  }

  async getTableMetadata(id: string): Promise<TabularTableMetadata | null> {
    const metadata = await this.metadataManager.get(id);
    return metadata ? this.toMetadata(metadata) : null;
  }

  async listTables(pluginId?: string, pagination?: PaginationOptions): Promise<TabularTableListResult> {
    const records = await this.metadataManager.list();
    const filtered = pluginId
      ? records.filter((entry) => entry.referencingPlugins?.includes(pluginId))
      : records;
    const offset = pagination?.offset ?? 0;
    const limit = pagination?.limit ?? filtered.length;
    const slice = filtered.slice(offset, offset + limit);
    return {
      total: slice.length,
      tables: slice.map((entry) => this.toMetadata(entry)),
    };
  }

  async deleteTable(tableMetadataId: string): Promise<void> {
    const metadata = await this.metadataManager.get(tableMetadataId);
    if (!metadata) return;
    await this.metadataManager.forceDelete(tableMetadataId);
    await this.removeRowData(tableMetadataId);
  }

  async getFilteredPreview(tableId: string, filters: TabularFilterRule[], rowCount: number): Promise<TabularDataResult> {
    const metadata = await this.metadataManager.get(tableId);
    if (!metadata) {
      throw new Error('Table not found');
    }
    const prepared = prepareFilters(filters);
    const projection = this.getColumnOrder(metadata);
    const { rows, totalMatches } = await this.collectRows(tableId, prepared, rowCount, projection);
    return {
      columns: metadata.columns ?? [],
      rows,
      totalRows: totalMatches,
      isChunked: Boolean(metadata.isChunked),
      chunkInfo: metadata.chunkCount
        ? {
            currentChunk: 0,
            totalChunks: metadata.chunkCount,
            chunkSize: rowCount,
          }
        : undefined,
    };
  }

  async getFilteredData(tableId: string, selection: TabularSelectionConfig): Promise<TabularDataResult> {
    const metadata = await this.metadataManager.get(tableId);
    if (!metadata) throw new Error('Table not found');
    const prepared = prepareFilters(selection.filterRules ?? []);
    const columns =
      selection.valueColumns && selection.valueColumns.length > 0
        ? selection.valueColumns
        : this.getColumnOrder(metadata);
    const { rows, totalMatches } = await this.collectRows(tableId, prepared, Number.POSITIVE_INFINITY, columns);
    return {
      columns: metadata.columns ?? [],
      rows,
      totalRows: totalMatches,
    };
  }

  async addTableReference(tableId: string, pluginId: string): Promise<void> {
    const metadata = await this.metadataManager.get(tableId);
    if (!metadata) throw new Error('Table not found');
    await this.metadataManager.addReference(tableId, pluginId);
  }

  async removeTableReference(tableId: string, pluginId: string): Promise<void> {
    const metadata = await this.metadataManager.get(tableId);
    if (!metadata) throw new Error('Table not found');
    const deleted = await this.metadataManager.removeReference(tableId, pluginId);
    if (deleted) {
      await this.removeRowData(tableId);
    }
  }

  async getProcessingStatus(): Promise<null> {
    return null;
  }

  private toParseOptions(config: TabularProcessingConfig) {
    const options: Record<string, unknown> = {};
    if (typeof config.delimiter === 'string') options.delimiter = config.delimiter;
    if (typeof config.hasHeader === 'boolean') options.header = config.hasHeader;
    if (typeof config.encoding === 'string') options.encoding = config.encoding;
    return options;
  }

  private deriveFilename(url: string): string {
    const withoutQuery = url.split('?')[0] ?? url;
    const tail = withoutQuery.split('/').pop();
    return tail && tail.trim().length > 0 ? tail : 'downloaded.csv';
  }

  private toMetadata(input: TabularTableMetadataLike): TabularTableMetadata {
    return {
      id: input.id,
      filename: input.filename ?? 'untitled.csv',
      fileUrl: input.fileUrl,
      contentHash: input.contentHash ?? '',
      fileSizeBytes: input.fileSizeBytes ?? 0,
      totalRows: input.totalRows ?? 0,
      columns: input.columns ?? [],
      createdAt: input.createdAt ?? Date.now(),
      updatedAt: input.updatedAt,
      referenceCount: input.referenceCount ?? (input.referencingPlugins?.length ?? 0),
      referencingPlugins: input.referencingPlugins ?? [],
      isChunked: input.isChunked,
      chunkCount: input.chunkCount,
    };
  }

  private getColumnOrder(metadata: TabularTableMetadataLike): string[] {
    return (metadata.columns ?? []).map((column) => column.name);
  }

  private async collectRows(
    tableId: string,
    filters: PreparedFilter[],
    limit: number,
    projectionOrder: string[],
  ): Promise<{ rows: Array<Record<string, string | number | null>>; totalMatches: number }> {
    const db = getRowStoreDB();
    const chunks = await db.rowChunks
      .where('[pluginId+tableId]')
      .equals([this.pluginId, tableId])
      .sortBy('chunkIndex');

    const rows: Array<Record<string, string | number | null>> = [];
    let totalMatches = 0;
    for (const chunk of chunks) {
      const chunkRows = decodeChunkRows(chunk as RowChunkLike);
      for (const row of chunkRows) {
        if (!matchesFilters(row, filters)) continue;
        totalMatches += 1;
        if (rows.length < limit) {
          rows.push(this.projectRow(row, projectionOrder));
        }
        if (rows.length >= limit) {
          continue;
        }
      }
    }
    return { rows, totalMatches };
  }

  private projectRow(
    row: TabularRow,
    projectionOrder: string[],
  ): Record<string, string | number | null> {
    const projected: Record<string, string | number | null> = {};
    const columns = projectionOrder.length > 0 ? projectionOrder : Object.keys(row);
    for (const column of columns) {
      projected[column] = normalizeValueForResult(row[column]);
    }
    return projected;
  }

  private async removeRowData(tableId: string): Promise<void> {
    const db = getRowStoreDB();
    await db.transaction('rw', db.rowChunks, db.rowIndexes, async () => {
      await db.rowChunks.where('[pluginId+tableId]').equals([this.pluginId, tableId]).delete();
      await db.rowIndexes
        .filter((entry) => entry.pluginId === this.pluginId && entry.tableId === tableId)
        .delete();
    });
  }

  private async resolveIngestSource(file: File): Promise<File | string> {
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
      return file;
    }
    return await this.readFileText(file);
  }

  private async readFileText(file: Blob): Promise<string> {
    if (typeof file.arrayBuffer === 'function') {
      const buffer = await file.arrayBuffer();
      return new TextDecoder().decode(buffer);
    }
    if (typeof file.text === 'function') {
      return await file.text();
    }
    if (typeof Response !== 'undefined') {
      const response = new Response(file);
      return await response.text();
    }
    throw new Error('Unable to read file contents for ingestion');
  }
}
