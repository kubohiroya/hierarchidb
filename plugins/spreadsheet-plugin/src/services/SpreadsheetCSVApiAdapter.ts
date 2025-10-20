import type {
  CSVDataResult,
  CSVFilterRule,
  CSVProcessingConfig,
  CSVProcessingStatus,
  CSVSelectionConfig,
  CSVTableListResult,
  TabularDataApi,
  PaginationOptions,
} from '@hierarchidb/ui-tabular-extract';
import { SpreadsheetTabularDriver } from './SpreadsheetTabularDriver.js';
import { SpreadsheetCSVApiDriver } from './SpreadsheetCSVApiDriver.js';
import { CSVTableMetadata, type CSVTableMetadataLike } from '@hierarchidb/tabular-store';

export class SpreadsheetCSVApiAdapter implements TabularDataApi {
  private tabularDriver: SpreadsheetTabularDriver;
  private driver: SpreadsheetCSVApiDriver;

  constructor(private pluginId: string = 'spreadsheet') {
    this.tabularDriver = new SpreadsheetTabularDriver(pluginId);
    this.driver = new SpreadsheetCSVApiDriver(pluginId);
  }

  async uploadCSVFile(file: File, _config?: CSVProcessingConfig): Promise<CSVTableMetadata> {
    const metadataLike = await this.tabularDriver.ingestFile(file);
    return await this.resolveMetadata(metadataLike);
  }

  async downloadCSVFromUrl(url: string, _config?: CSVProcessingConfig): Promise<CSVTableMetadata> {
    return await this.driver.downloadCSVFromUrl(url, _config ?? {});
  }

  async getFilteredPreview(
    tableId: string,
    filters: CSVFilterRule[],
    rowCount: number,
    startRow?: number,
  ): Promise<CSVDataResult> {
    return await this.driver.getFilteredPreview(tableId, filters, rowCount, startRow);
  }

  // --- Delegations for full TabularDataApi surface ---
  async getTableMetadata(_id: string): Promise<CSVTableMetadata | null> {
    try {
      return await this.driver.getTableMetadata(_id);
    } catch {
      return null;
    }
  }

  async listTables(_pluginId?: string, _pagination?: PaginationOptions): Promise<CSVTableListResult> {
    return await this.driver.listTables(_pluginId ?? this.pluginId, _pagination);
  }

  async deleteTable(_tableMetadataId: string): Promise<void> {
    await this.driver.deleteTable(_tableMetadataId);
  }

  async getFilteredData(tableId: string, selection: CSVSelectionConfig): Promise<CSVDataResult> {
    return await this.driver.getFilteredData(tableId, selection);
  }

  async addTableReference(_tableId: string, _pluginId: string): Promise<void> {
    await this.driver.addTableReference(_tableId, _pluginId);
  }

  async removeTableReference(_tableId: string, _pluginId: string): Promise<void> {
    await this.driver.removeTableReference(_tableId, _pluginId);
  }

  async getProcessingStatus?(_id: string): Promise<CSVProcessingStatus | null> {
    // Not tracked yet
    return null;
  }

  private async resolveMetadata(metadata: CSVTableMetadataLike): Promise<CSVTableMetadata> {
    const resolved = await this.driver.getTableMetadata(metadata.id);
    if (resolved) {
      return resolved;
    }

    return {
      id: metadata.id,
      filename: metadata.filename ?? 'untitled.csv',
      fileUrl: metadata.fileUrl,
      contentHash: metadata.contentHash ?? '',
      fileSizeBytes: metadata.fileSizeBytes ?? 0,
      totalRows: metadata.totalRows ?? 0,
      columns: metadata.columns ?? [],
      createdAt: metadata.createdAt ?? Date.now(),
      updatedAt: metadata.updatedAt,
      referenceCount: metadata.referenceCount ?? 0,
      referencingPlugins: metadata.referencingPlugins ?? [],
      isChunked: metadata.isChunked,
      chunkCount: metadata.chunkCount,
    };
  }
}

export function createSpreadsheetCSVApi(pluginId: string = 'spreadsheet'): TabularDataApi {
  return new SpreadsheetCSVApiAdapter(pluginId);
}
