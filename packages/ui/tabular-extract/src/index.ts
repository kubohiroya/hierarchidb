/**
 * @file openstreetmap-type.ts
 * @description Main export file for ui-tabular-extract package
 */

// Types
export type {
  TabularFilterOperator,
  TabularFilterRule,
  TabularProcessingConfig,
  TabularSelectionConfig,
  TabularDataResult,
  TabularColumnMapping,
  TabularExtractResult,
  PaginationOptions,
  TabularTableListResult,
  TabularProcessingStatus,
  TabularDataApi,
} from './types/index.js';

// Context
export { TabularProvider, useTabularApi } from './context/TabularContext.js';
export type { TabularProviderProps } from './context/TabularContext.js';

// Hooks
export { useTabularData } from './hooks/useTabularData.js';
export { useTabularFilter } from './hooks/useTabularFilter.js';
export type { UseTabularDataOptions, UseTabularDataResult } from './hooks/useTabularData.js';
export type { UseTabularFilterOptions, UseTabularFilterResult } from './hooks/useTabularFilter.js';

// Components
export {
  TabularDataImport,
  TabularDataFilter,
  TabularColumnSelect,
  TabularDataFilterRulesTable,
  TabularPreviewLite,
} from './components/index.js';
export type {
  TabularDataImportProps,
  TabularDataFilterProps,
  TabularColumnSelectProps,
  FilterOperatorOption,
  TabularPreviewLiteProps,
} from './components/index.js';

// Preview (re-export from ui-data-grid)
export { TabularPreview } from '@hierarchidb/ui-data-grid';
