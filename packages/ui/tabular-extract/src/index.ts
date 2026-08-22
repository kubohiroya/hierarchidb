/**
 * @file openstreetmap-type.ts
 * @description Main export file for ui-tabular package
 */

// Preview (re-export from ui-grid)
export { DataGridPreview } from '@hierarchidb/ui-grid';
export type {
  FilterOperatorOption,
  TabularColumnSelectProps,
  TabularDataFilterProps,
  TabularDataImportProps,
  TabularPreviewGridProps,
} from './components/index.js';
// Components
export {
  TabularColumnSelect,
  TabularDataFilter,
  TabularDataFilterRulesTable,
  TabularDataImport,
  TabularPreviewGrid,
} from './components/index.js';
export type { TabularProviderProps } from './context/TabularContext.js';
// Context
export { TabularProvider, useTabularApi } from './context/TabularContext.js';
export type { UseTabularDataOptions, UseTabularDataResult } from './hooks/useTabularData.js';
// Hooks
export { useTabularData } from './hooks/useTabularData.js';
export type { UseTabularFilterOptions, UseTabularFilterResult } from './hooks/useTabularFilter.js';
export { useTabularFilter } from './hooks/useTabularFilter.js';
// Types
export type {
  PaginationOptions,
  TabularColumnMapping,
  TabularDataApi,
  TabularDataResult,
  TabularExtractResult,
  TabularFilterOperator,
  TabularFilterRule,
  TabularProcessingConfig,
  TabularProcessingStatus,
  TabularSelectionConfig,
  TabularTableListResult,
} from './types/index.js';
