// Main components
export {
  CountryMatrixSelector,
  CountryMatrixStep,
} from './components/index.js';

export type {
  CountryMatrixSelectorProps,
  CountryMatrixStepProps,
} from './components/index.js';

// Types and column sets
export type {
  Country,
  ContinentCode,
  Continent,
  CountrySelection,
  CountryFilter,
  MatrixColumnBase,
  AdminLevelColumn,
  TransportHubColumn,
  RouteTypeColumn,
  CustomColumn,
  MatrixColumn,
  ColumnSetType,
  ColumnSet,
  MatrixSelection,
  MatrixConfig,
} from './types/index.js';

export {
  CONTINENTS,
  ADMIN_LEVELS_COLUMN_SET,
  TRANSPORT_HUBS_COLUMN_SET,
  ROUTE_TYPES_COLUMN_SET,
  AIRPORTS_COLUMN_SET,
  PORTS_COLUMN_SET,
  COLUMN_SETS,
  getColumnSet,
  getColumnSetTypes,
} from './types/index.js';

// Hooks
export { useCountrySelection } from './hooks/index.js';
export type {
  UseCountrySelectionOptions,
  UseCountrySelectionResult,
} from './hooks/index.js';

// Utilities
export {
  exportSelections,
  importSelections,
  tabularToSelections,
  getSelectionsSummary,
  mergeSelections,
  filterSelections,
} from './utils/index.js';

export type { SelectionExport } from './utils/index.js';

// Sample data
export {
  SAMPLE_COUNTRIES,
  getCountriesByContinent,
  getCountryByCode,
  searchCountries,
} from './data/index.js';