export { PLUGIN_MANIFEST as SpreadsheetPluginManifest } from './plugin-manifest.js';
export type {
  DataSourceType,
  SpreadSheetDataSourceType,
  SpreadsheetEntity,
  UploadedFileSummary,
} from './common/types/SpreadsheetEntity.js';
// constants (expanded from common/constants.js to avoid export * causing shared DTS chunks)
export {
  SPREADSHEET_PLUGIN_ID,
  SPREADSHEET_PLUGIN_VERSION,
  SPREADSHEET_NODE_TYPE,
} from './plugin-manifest.js';
export { DATA_SOURCE_TYPES, STEP_LABELS } from './common/constants.js';
// services (expanded from services/index.js to avoid export * causing shared DTS chunks)
export { SpreadsheetTabularApiDriver } from './services/SpreadsheetTabularApiDriver.js';
export { SpreadsheetMetadataManager } from './services/SpreadsheetMetadataManager.js';
export { SpreadsheetStorePort } from './services/SpreadsheetStorePort.js';
export {
  createSpreadsheetTabularApi,
  createPluginTabularApi,
} from './services/spreadsheetTabularApiFactory.js';
export type { PluginTabularApiOptions } from './services/spreadsheetTabularApiFactory.js';
