// Local minimal copies of tabular-extract types to keep service-only typecheck isolated
interface CSVProcessingConfig {
  [key: string]: any;
}

interface CSVFilterRule {
  field: string;
  op: string;
  value?: any;
}

interface CSVColumnInfo {
  name: string;
  type?: string;
  uniqueValues?: number;
}

interface CSVTableMetadata {
  id: string;
  name: string;
  rowCount?: number;
  columns?: CSVColumnInfo[];
}

interface CSVDataResult {
  rows: any[];
  total: number;
  columns?: CSVColumnInfo[];
}

interface CSVSelectionConfig {
  filterRules?: CSVFilterRule[];
  limit?: number;
  offset?: number;
}

interface PaginationOptions {
  offset: number;
  limit: number;
}

interface CSVTableListResult {
  tables: CSVTableMetadata[];
  total: number;
}

interface CSVProcessingStatus {
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  info?: string;
}

interface ICSVDataApi {
  uploadCSVFile(file: File, config: CSVProcessingConfig): Promise<CSVTableMetadata>;

  downloadCSVFromUrl(url: string, config: CSVProcessingConfig): Promise<CSVTableMetadata>;

  getTableMetadata(id: string): Promise<CSVTableMetadata | null>;

  listTables(pluginId?: string, pagination?: PaginationOptions): Promise<CSVTableListResult>;

  deleteTable(tableMetadataId: string): Promise<void>;

  getFilteredPreview(tableId: string, filters: CSVFilterRule[], rowCount: number): Promise<CSVDataResult>;

  getFilteredData(tableId: string, selection: CSVSelectionConfig): Promise<CSVDataResult>;

  addTableReference(tableId: string, pluginId: string): Promise<void>;

  removeTableReference(tableId: string, pluginId: string): Promise<void>;

  getProcessingStatus?(id: string): Promise<CSVProcessingStatus | null>;
}

export class SpreadsheetCSVApiAdapter implements ICSVDataApi {
  constructor(_pluginId: string = 'spreadsheet') {
    void _pluginId;
  }

  async uploadCSVFile(_file: File, _config: CSVProcessingConfig): Promise<CSVTableMetadata> {
    return { id: 'stub', name: 'stub.csv' };
  }

  async downloadCSVFromUrl(_url: string, _config: CSVProcessingConfig): Promise<CSVTableMetadata> {
    return { id: 'stub', name: 'stub.csv' };
  }

  async getTableMetadata(_id: string): Promise<CSVTableMetadata | null> {
    return null;
  }

  async listTables(_pluginId?: string, _pagination?: PaginationOptions): Promise<CSVTableListResult> {
    return { tables: [], total: 0 };
  }

  async deleteTable(_tableMetadataId: string): Promise<void> { /* noop */
  }

  async getFilteredPreview(_tableId: string, _filters: CSVFilterRule[], _rowCount: number): Promise<CSVDataResult> {
    return { rows: [], total: 0 };
  }

  async getFilteredData(_tableId: string, _selection: CSVSelectionConfig): Promise<CSVDataResult> {
    return { rows: [], total: 0 };
  }

  async addTableReference(_tableId: string, _pluginId: string): Promise<void> { /* noop */
  }

  async removeTableReference(_tableId: string, _pluginId: string): Promise<void> { /* noop */
  }

  async getProcessingStatus?(_id: string): Promise<CSVProcessingStatus | null> {
    return null;
  }
}
