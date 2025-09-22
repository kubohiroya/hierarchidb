export { SpreadsheetExtension } from './extension/definition.js';
export type {
  DataSourceConfig,
  FileInfo,
  FilterOperator,
  RowFilter,
  ColumnFilter,
  FilterConfig,
  SpreadsheetExtendedFields,
  ValidationResult,
  SpreadsheetFormData,
} from './extension/types.js';
export type { SpreadsheetEntity, SpreadsheetWorkingCopy } from './extension/definition.js';
export * from './extension/constants.js';
export * from './steps/DataSourceStep.js';
export * from './steps/FilteringStep.js';
export * from './services/index.js';

// Folder dialog extension initializer (optional)
export { initializeSpreadsheetFolderExtension, spreadsheetFolderExtension } from './extensions/SpreadsheetFolderExtension.js';

// Register UI steps-provider for host-composed dialog (idempotent)
import './ui/steps-provider';
