/**
 * @hierarchidb/ui-data-grid
 *
 * Abstract data grid components using the Data Provider pattern.
 * Works with any data source through abstract interfaces.
 */

// Core components
export { AbstractDataGrid } from './AbstractDataGrid';
export type { AbstractDataGridProps } from './AbstractDataGrid';

// Legacy generic grid (will be deprecated)
export { GenericDataGrid } from './GenericDataGrid';
export type { GenericDataGridProps, GridColumn } from './GenericDataGrid';

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
} from './types/DataProvider';

// Built-in providers
export { InMemoryDataProvider } from './providers/InMemoryDataProvider';