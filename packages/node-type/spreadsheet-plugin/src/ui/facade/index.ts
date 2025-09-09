import type {
  CSVDataResult,
  CSVFilterRule,
  CSVProcessingConfig,
  CSVProcessingStatus,
  CSVSelectionConfig,
  CSVTableListResult,
  CSVTableMetadata,
  ICSVDataApi,
  PaginationOptions,
} from '@hierarchidb/ui-csv-extract';

// UI-only facade to avoid pulling service layer into typecheck.
// Delegates at runtime via dynamic import.
export function createSpreadsheetCSVApi(pluginId: string = 'spreadsheet'): ICSVDataApi {
  const getAdapter = async () => {
    const mod = await import('../../services/SpreadsheetCSVApiAdapter');
    return mod.createSpreadsheetCSVApi(pluginId);
  };

  const api: ICSVDataApi = {
    uploadCSVFile: async (file: File, config?: CSVProcessingConfig): Promise<CSVTableMetadata> => {
      const a = await getAdapter();
      return a.uploadCSVFile(file, (config ?? {}) as CSVProcessingConfig);
    },
    downloadCSVFromUrl: async (url: string, config?: CSVProcessingConfig): Promise<CSVTableMetadata> => {
      const a = await getAdapter();
      return a.downloadCSVFromUrl(url, (config ?? {}) as CSVProcessingConfig);
    },
    getFilteredPreview: async (
      tableId: string,
      filters: CSVFilterRule[],
      rowCount: number,
    ): Promise<CSVDataResult> => {
      const a = await getAdapter();
      return a.getFilteredPreview(tableId, filters, rowCount);
    },
    getFilteredData: async (tableId: string, selection: CSVSelectionConfig): Promise<CSVDataResult> => {
      const a = await getAdapter();
      return a.getFilteredData(tableId, selection);
    },
    getTableMetadata: async (id: string): Promise<CSVTableMetadata | null> => {
      const a = await getAdapter();
      return a.getTableMetadata(id);
    },
    listTables: async (_pluginId?: string, pagination?: PaginationOptions): Promise<CSVTableListResult> => {
      const a = await getAdapter();
      return a.listTables(_pluginId, pagination);
    },
    deleteTable: async (tableMetadataId: string): Promise<void> => {
      const a = await getAdapter();
      return a.deleteTable(tableMetadataId);
    },
    addTableReference: async (tableId: string, pId: string): Promise<void> => {
      const a = await getAdapter();
      return a.addTableReference(tableId, pId);
    },
    removeTableReference: async (tableId: string, pId: string): Promise<void> => {
      const a = await getAdapter();
      return a.removeTableReference(tableId, pId);
    },
    getProcessingStatus: async (id: string): Promise<CSVProcessingStatus | null> => {
      const a = await getAdapter();
      return a.getProcessingStatus?.(id) ?? null;
    },
  };

  return api;
}

