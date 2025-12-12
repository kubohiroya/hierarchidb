// Facade package for UI-friendly datasource items (self-contained)
// Import paths must not reach into other packages' source files.

// Components
export { DataSourceSelector } from './DataSourceSelector.js';
export type { DataSourceSelectorProps, DataSourceOption } from './DataSourceSelector.js';
export { DataSourceSelectionStep } from './DataSourceSelectionStep.js';
export type { DataSourceSelectionStepProps } from './DataSourceSelectionStep.js';

// Types and utilities
export {
  DATA_SOURCES,
  getDataSourceConfig,
  getDataSourcesByCategory,
  getLicenseColor,
  extractLimitations,
} from './types/DataSource.js';
export type {
  DataSourceName,
  DataSourceCategory,
  LicenseType,
  UsageType,
  DataSourceConfig,
  DataSourceInfo,
} from './types/DataSource.js';

// Service TYPES only (no runtime-worker implementations here)
export type {
  DataSourceStrategy,
  CountryMetadata,
  AdminLevelInfo,
  DataSourceValidationResult,
  BoundingBox,
} from './types/RuntimeTypes.js';
