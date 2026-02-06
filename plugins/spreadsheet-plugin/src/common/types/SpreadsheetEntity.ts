import type {
  DataSourceType as SpreadsheetDataSourceType,
  SpreadSheetDataSourceType as SpreadsheetSpreadSheetDataSourceType,
  SpreadsheetEntity as SpreadsheetEntityType,
  UploadedFileSummary as SpreadsheetUploadedFileSummary,
} from '@hierarchidb/spreadsheet-store';

export type DataSourceType = SpreadsheetDataSourceType;
export type SpreadSheetDataSourceType = SpreadsheetSpreadSheetDataSourceType;
export type SpreadsheetEntity = SpreadsheetEntityType;
export type SpreadsheetDraft = Partial<SpreadsheetEntityType>;
export type UploadedFileSummary = SpreadsheetUploadedFileSummary;
