export { SpreadsheetExtension } from './common/extension/definition.js';
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
} from './common/extension/types.js';
export type { SpreadsheetEntity, SpreadsheetWorkingCopy } from './common/extension/definition.js';
export * from './common/extension/constants.js';
export { PLUGIN_MANIFEST as SpreadsheetPluginManifest } from './plugin-manifest.js';
export * from './services/index.js';

// Folder dialog extension initializer (optional)
export { initializeSpreadsheetDialogExtension, spreadsheetDialogExtension } from './common/extensions/index.js';

// Register UI steps-provider for host-composed dialog (idempotent)
import './ui/steps-provider';
