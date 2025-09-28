import { registerRuntimeWorkerNotImplemented } from '@hierarchidb/plugins-runtime-worker-factory';

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

// Dialog extension initializer (optional)
export { initializeSpreadsheetDialogExtension, spreadsheetDialogExtension } from './extensions/SpreadsheetDialogExtension.js';

// Register UI steps-provider for host-composed dialog (idempotent)
import './ui/steps-provider';

export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    registerRuntimeWorkerNotImplemented('spreadsheet', '[spreadsheet-plugin] runtime worker integration is not implemented yet');
  }
}
