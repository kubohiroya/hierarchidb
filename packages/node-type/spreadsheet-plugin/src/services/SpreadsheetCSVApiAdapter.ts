import type {
  ICSVDataApi,
  CSVTableMetadata,
  CSVProcessingConfig,
  CSVFilterRule,
  CSVDataResult,
} from '@hierarchidb/ui-csv-extract';
import { SpreadsheetTabularDriver } from './SpreadsheetTabularDriver';
import { SpreadsheetCSVApiDriver } from './SpreadsheetCSVApiDriver';

export class SpreadsheetCSVApiAdapter implements ICSVDataApi {
  constructor(private pluginId: string = 'spreadsheet') {}

  async uploadCSVFile(file: File, _config?: CSVProcessingConfig): Promise<CSVTableMetadata> {
    const driver = new SpreadsheetTabularDriver(this.pluginId);
    return await driver.ingestFile(file);
  }

  async downloadCSVFromUrl(url: string, _config?: CSVProcessingConfig): Promise<CSVTableMetadata> {
    const { authFetch } = await import('./utils/authFetch');
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
}

export function createSpreadsheetCSVApi(pluginId: string = 'spreadsheet'): ICSVDataApi {
  return new SpreadsheetCSVApiAdapter(pluginId);
}
