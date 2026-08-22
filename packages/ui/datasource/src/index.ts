// Facade package for UI-friendly datasource items (self-contained)
// Import paths must not reach into other packages' source files.

export type { DataSourceDetailsCardProps } from './DataSourceDetailsCard.js';
// Components
export { DataSourceDetailsCard } from './DataSourceDetailsCard.js';
export type { DataSourceSelectionCardProps } from './DataSourceSelectionCard.js';
export { DataSourceSelectionCard } from './DataSourceSelectionCard.js';
export type {
  DataSourceSelectionOption,
  DataSourceSelectionState,
  DataSourceSelectionStepProps,
} from './DataSourceSelectionStep.js';
export { DataSourceSelectionStep } from './DataSourceSelectionStep.js';
export type { DataSourceOption, DataSourceSelectorProps } from './DataSourceSelector.js';
export { DataSourceSelector } from './DataSourceSelector.js';
export type {
  DataSourceWithLicenseOption,
  DataSourceWithLicenseProps,
  DataSourceWithLicenseState,
} from './DataSourceWithLicense.js';
export { DataSourceWithLicense } from './DataSourceWithLicense.js';
export type {
  IdeGsmFileEntry,
  IdeGsmImportLabels,
  IdeGsmImportPanelProps,
  IdeGsmImportPayload,
} from './IdeGsmImportPanel.js';
export { IdeGsmImportPanel } from './IdeGsmImportPanel.js';
export type {
  DataSourceCategory,
  DataSourceConfig,
  DataSourceInfo,
  DataSourceName,
  LicenseType,
  UsageType,
} from './types/DataSource.js';
// Types and utilities
export {
  DATA_SOURCES,
  extractLimitations,
  getDataSourceConfig,
  getDataSourcesByCategory,
  getLicenseColor,
} from './types/DataSource.js';

// Service TYPES only (no runtime-worker implementations here)
export type {
  AdminLevelInfo,
  BoundingBox,
  CountryMetadata,
  DataSourceStrategy,
  DataSourceValidationResult,
} from './types/RuntimeTypes.js';
