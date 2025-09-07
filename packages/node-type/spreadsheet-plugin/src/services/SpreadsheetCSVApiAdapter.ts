import type {
  ICSVDataApi,
  CSVTableMetadata,
  CSVProcessingConfig,
  CSVFilterRule,
  CSVDataResult,
  CSVSelectionConfig,
  CSVTableListResult,
  PaginationOptions,
  CSVProcessingStatus,
} from '@hierarchidb/ui-csv-extract';
import { SpreadsheetTabularDriver } from './SpreadsheetTabularDriver';
import { SpreadsheetCSVApiDriver } from './SpreadsheetCSVApiDriver';
import { authFetch } from './utils/authFetch';

export class SpreadsheetCSVApiAdapter implements ICSVDataApi {
  constructor(private pluginId: string = 'spreadsheet') {}

  async uploadCSVFile(file: File, _config?: CSVProcessingConfig): Promise<CSVTableMetadata> {
    const driver = new SpreadsheetTabularDriver(this.pluginId);
    // Driver returns a CSVTableMetadataLike; cast to strict metadata for UI boundary.
    return (await driver.ingestFile(file)) as unknown as CSVTableMetadata;
  }

  async downloadCSVFromUrl(url: string, _config?: CSVProcessingConfig): Promise<CSVTableMetadata> {
    const res = await authFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const filename = url.split('/').pop() || 'downloaded.csv';
    const file = new File([buf], filename, { type: res.headers.get('content-type') || 'application/octet-stream' });
    return await this.uploadCSVFile(file);
  }

  async getFilteredPreview(
    tableId: string,
    filters: CSVFilterRule[],
    rowCount: number,
    startRow?: number
  ): Promise<CSVDataResult> {
    // Delegate to existing driver which knows how to read stored chunks
    const legacy = new SpreadsheetCSVApiDriver(this.pluginId);
    return await legacy.getFilteredPreview(tableId, filters, rowCount, startRow);
  }

  // --- Stubs for full ICSVDataApi surface; delegate/NOOP for now ---
  async getTableMetadata(_id: string): Promise<CSVTableMetadata | null> {
    try {
      const legacy = new SpreadsheetCSVApiDriver(this.pluginId);
      // Delegate to table manager when available; return null as placeholder
      return await legacy.getTableMetadata(_id);
    } catch {
      return null;
    }
  }

  async listTables(_pluginId?: string, _pagination?: PaginationOptions): Promise<CSVTableListResult> {
    return { tables: [], total: 0 };
  }

  async deleteTable(_tableMetadataId: string): Promise<void> {
    // NOOP stub for now
  }

  async getFilteredData(tableId: string, selection: CSVSelectionConfig): Promise<CSVDataResult> {
    // Fallback to preview path; for large exports, driver will implement efficiently later
    const filters = (selection as any).filterRules ?? [];
    return this.getFilteredPreview(tableId, filters, Number.MAX_SAFE_INTEGER, 0);
  }

  async addTableReference(_tableId: string, _pluginId: string): Promise<void> {
    // NOOP stub (reference counting to be implemented in DB layer)
  }

  async removeTableReference(_tableId: string, _pluginId: string): Promise<void> {
    // NOOP stub (reference counting to be implemented in DB layer)
  }

  async getProcessingStatus?(_id: string): Promise<CSVProcessingStatus | null> {
    // Not tracked yet
    return null;
  }
}

export function createSpreadsheetCSVApi(pluginId: string = 'spreadsheet'): ICSVDataApi {
  return new SpreadsheetCSVApiAdapter(pluginId);
}
