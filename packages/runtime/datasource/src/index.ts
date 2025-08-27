// Components
export {
  DataSourceSelector,
  DataSourceLicenseAgreement,
  DataSourceSelectionStep,
  DataSourceLicenseStep,
} from './components';

export type {
  DataSourceSelectorProps,
  DataSourceLicenseAgreementProps,
  DataSourceSelectionStepProps,
  DataSourceLicenseStepProps,
} from './components';

// Services
export {
  DataSourceManager,
  GADMStrategy,
  NaturalEarthStrategy,
  GeoBoundariesStrategy,
  OpenStreetMapStrategy,
} from './services/DataSourceManager';

export type {
  DataSourceStrategy,
  CountryMetadata,
  AdminLevelInfo,
  ValidationResult,
  BoundingBox,
  DataSourceInfo,
} from './services/DataSourceManager';

// Types and utilities
export {
  DATA_SOURCES,
  getDataSourceConfig,
  getDataSourcesByCategory,
  getLicenseColor,
  extractLimitations,
} from './types/DataSource';

export type {
  DataSourceName,
  DataSourceCategory,
  LicenseType,
  UsageType,
  DataSourceConfig,
} from './types/DataSource';