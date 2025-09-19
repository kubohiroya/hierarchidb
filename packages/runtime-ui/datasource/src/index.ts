// Components
export {
  DataSourceSelector,
  DataSourceLicenseAgreement,
  DataSourceSelectionStep,
  DataSourceLicenseStep,
} from './components/index.js';

export type {
  DataSourceSelectorProps,
  DataSourceLicenseAgreementProps,
  DataSourceSelectionStepProps,
  DataSourceLicenseStepProps,
} from './components/index.js';

// Services
export {
  DataSourceManager,
  GADMStrategy,
  NaturalEarthStrategy,
  GeoBoundariesStrategy,
  OpenStreetMapStrategy,
} from './services/DataSourceManager.js';

export type {
  DataSourceStrategy,
  CountryMetadata,
  AdminLevelInfo,
  ValidationResult,
  BoundingBox,
  DataSourceInfo,
} from './services/DataSourceManager.js';

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
} from './types/DataSource.js';