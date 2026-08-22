// Main components

export type {
  CountryMatrixSelectorProps,
  CountryMatrixStepProps,
} from './components/index.js';
export {
  CountryMatrixSelector,
  CountryMatrixStep,
} from './components/index.js';
export type {
  UseCountryI18nResult,
  UseCountrySelectionOptions,
  UseCountrySelectionResult,
} from './hooks/index.js';
// Hooks
export { useCountrySelection } from './hooks/index.js';
export { useCountryI18n } from './hooks/useCountryI18n.js';
// ISO country loader (from ISO-3166-2 CSV; returns Country[])
export { useIsoCountries } from './hooks/useIsoCountries.js';
// Types and column sets
export type {
  AdminLevelColumn,
  ColumnSet,
  ColumnSetType,
  Continent,
  ContinentCode,
  Country,
  CountryFilter,
  CountrySelection,
  CustomColumn,
  MatrixColumn,
  MatrixColumnBase,
  MatrixConfig,
  MatrixSelection,
  RouteTypeColumn,
  TransportHubColumn,
} from './types/index.js';
export {
  ADMIN_LEVELS_COLUMN_SET,
  AIRPORTS_COLUMN_SET,
  COLUMN_SETS,
  CONTINENTS,
  getColumnSet,
  getColumnSetTypes,
  PORTS_COLUMN_SET,
  ROUTE_TYPES_COLUMN_SET,
  TRANSPORT_HUBS_COLUMN_SET,
} from './types/index.js';

export type { SelectionExport } from './utils/index.js';
// Utilities
export {
  exportSelections,
  filterSelections,
  getSelectionsSummary,
  importSelections,
  mergeSelections,
  tabularToSelections,
} from './utils/index.js';
