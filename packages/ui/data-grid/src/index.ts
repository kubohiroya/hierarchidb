/**
 * @hierarchidb/ui-grid
 *
 * Abstract data grid components using the Data Provider pattern.
 * Works with any data source through abstract interfaces.
 */

export type { AbstractDataGridProps } from './AbstractDataGrid.js';
// Core components
export { AbstractDataGrid } from './AbstractDataGrid.js';
export * from './CrossViewSnackbar.js';
export { CrossViewStyles } from './CrossViewStyles.js';
export { DataGridPreview } from './DataGridPreview.js';
export type { GenericDataGridProps, GridColumn } from './GenericDataGrid.js';
// Legacy generic grid (will be deprecated)
export { GenericDataGrid } from './GenericDataGrid.js';
export * from './hooks/useCrossHighlightSync.js';

// Built-in providers
export { InMemoryDataProvider } from './providers/InMemoryDataProvider.js';
export {
  buildGridStateKey,
  loadGridStateValue,
  saveGridStateValue,
} from './storage/gridStateStorage.js';
export type {
  GridCellClickParams,
  GridCellEditParams,
  GridColumnSizingState,
  GridColumnVisibilityState,
  GridGroupingState,
  GridRowState,
  GridSortingState,
  TanstackDataGridProps,
} from './TanstackDataGrid.js';
export { TanstackDataGrid } from './TanstackDataGrid.js';
// Data provider types
export type {
  ColumnDefinition,
  DataChangeEvent,
  DataItem,
  DataProvider,
  FilterParams,
  PaginationParams,
  QueryParams,
  QueryResult,
  SchemaDefinition,
  SortParams,
} from './types/DataProvider.js';
