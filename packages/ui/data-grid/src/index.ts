/**
 * @hierarchidb/ui-grid
 *
 * Abstract data grid components using the Data Provider pattern.
 * Works with any data source through abstract interfaces.
 */

// Core components
export { AbstractDataGrid } from './AbstractDataGrid.js';
export type { AbstractDataGridProps } from './AbstractDataGrid.js';

// Legacy generic grid (will be deprecated)
export { GenericDataGrid } from './GenericDataGrid.js';
export type { GenericDataGridProps, GridColumn } from './GenericDataGrid.js';
export { TanstackDataGrid } from './TanstackDataGrid.js';
export type {
  TanstackDataGridProps,
  GridSortingState,
  GridGroupingState,
  GridColumnSizingState,
  GridColumnVisibilityState,
  GridCellEditParams,
  GridCellClickParams,
  GridRowState,
} from './TanstackDataGrid.js';

export {
  buildGridStateKey,
  loadGridStateValue,
  saveGridStateValue,
} from './storage/gridStateStorage.js';

// Data provider types
export type {
  DataProvider,
  DataItem,
  QueryParams,
  QueryResult,
  PaginationParams,
  SortParams,
  FilterParams,
  ColumnDefinition,
  SchemaDefinition,
  DataChangeEvent,
} from './types/DataProvider.js';

// Built-in providers
export { InMemoryDataProvider } from './providers/InMemoryDataProvider.js';

export {CrossViewStyles} from './CrossViewStyles.js';
export * from './CrossViewSnackbar.js';
export * from './hooks/useCrossHighlightSync.js';
export { DataGridPreview } from './DataGridPreview.js';
