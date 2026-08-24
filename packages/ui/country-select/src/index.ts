// Main components

export type { CountryMatrixSelectorProps } from './components/CountryMatrixSelector.js';
export type { CountryMatrixStepProps } from './components/CountryMatrixStep.js';
export { CountryMatrixSelector } from './components/CountryMatrixSelector.js';
export { CountryMatrixStep } from './components/CountryMatrixStep.js';
export type { UseCountryI18nResult } from './hooks/useCountryI18n.js';
export type { UseCountrySelectionOptions, UseCountrySelectionResult } from './hooks/useCountrySelection.js';
// Hooks
export { useCountrySelection } from './hooks/useCountrySelection.js';
export { useCountryI18n } from './hooks/useCountryI18n.js';
// ISO country loader (from ISO-3166-2 CSV; returns Country[])
export { useIsoCountries } from './hooks/useIsoCountries.js';
// Types and column sets
export type { AdminLevelColumn, ColumnSet, ColumnSetType, CustomColumn, MatrixColumn, MatrixColumnBase, MatrixConfig, MatrixSelection, RouteTypeColumn, TransportHubColumn } from './types/MatrixColumn.js';
export type { Continent, ContinentCode, Country, CountryFilter, CountrySelection } from './types/Country.js';
export { ADMIN_LEVELS_COLUMN_SET, AIRPORTS_COLUMN_SET, COLUMN_SETS, getColumnSet, getColumnSetTypes, PORTS_COLUMN_SET, ROUTE_TYPES_COLUMN_SET, TRANSPORT_HUBS_COLUMN_SET } from './types/ColumnSets.js';
export { CONTINENTS } from './types/Country.js';

export type { SelectionExport } from './utils/selectionUtils.js';
// Utilities
export { exportSelections, filterSelections, getSelectionsSummary, importSelections, mergeSelections, tabularToSelections } from './utils/selectionUtils.js';
