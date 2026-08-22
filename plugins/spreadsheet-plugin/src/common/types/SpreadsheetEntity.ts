import type {
  DataSourceType as SpreadsheetDataSourceType,
  SpreadsheetEntity as SpreadsheetEntityType,
  SpreadSheetDataSourceType as SpreadsheetSpreadSheetDataSourceType,
  UploadedFileSummary as SpreadsheetUploadedFileSummary,
} from '@hierarchidb/spreadsheet-store';

export type DataSourceType = SpreadsheetDataSourceType;
export type SpreadSheetDataSourceType = SpreadsheetSpreadSheetDataSourceType;
export type SpreadsheetEntity = SpreadsheetEntityType;
export type SpreadsheetDraft = Partial<SpreadsheetEntityType>;
export type UploadedFileSummary = SpreadsheetUploadedFileSummary;
