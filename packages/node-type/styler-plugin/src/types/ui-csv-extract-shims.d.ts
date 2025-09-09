// Minimal type shims for @hierarchidb/ui-csv-extract used by styler-plugin
// These satisfy DTS generation without importing the full package types.

declare module '@hierarchidb/ui-csv-extract' {
  export interface CSVColumnMetadata {
    name: string;
    type?: string;
  }

  export interface CSVTableMetadata {
    id?: string;
    name?: string;
    columns: CSVColumnMetadata[];
    referencingPlugins?: string[];
  }

  export interface CSVDataResult {
    rows: Array<Record<string, any>>;
    columns?: CSVColumnMetadata[];
    totalRows?: number;
  }

  export type CSVFilterRule = any;
  export type CSVProcessingConfig = Record<string, any>;

  export interface ICSVDataApi {
    uploadCSVFile(file: File, config?: CSVProcessingConfig): Promise<CSVTableMetadata>;

    downloadCSVFromUrl(url: string, config?: CSVProcessingConfig): Promise<CSVTableMetadata>;

    getFilteredPreview(tableId: string, filters?: CSVFilterRule[], rowCount?: number): Promise<CSVDataResult>;

    addTableReference(tableId: string, pluginId: string): Promise<void>;

    removeTableReference(tableId: string, pluginId: string): Promise<void>;

    listTables(): Promise<{ tables: CSVTableMetadata[] }>;
  }
}

