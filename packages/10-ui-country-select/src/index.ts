// Main components
export {
  CountryMatrixSelector,
  CountryMatrixStep,
} from './components';

export type {
  CountryMatrixSelectorProps,
  CountryMatrixStepProps,
} from './components';

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
} from './types';

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
} from './types';

// Hooks
export { useCountrySelection } from './hooks';
export type {
  UseCountrySelectionOptions,
  UseCountrySelectionResult,
} from './hooks';

// Utilities
export {
  exportSelections,
  importSelections,
  selectionsToCSV,
  csvToSelections,
  getSelectionsSummary,
  mergeSelections,
  filterSelections,
} from './utils';

export type { SelectionExport } from './utils';

// Sample data
export {
  SAMPLE_COUNTRIES,
  getCountriesByContinent,
  getCountryByCode,
  searchCountries,
} from './data';