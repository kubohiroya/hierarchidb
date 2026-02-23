import { SpreadsheetTabularApiDriver } from '../../../../spreadsheet-plugin/src/services/SpreadsheetTabularApiDriver.js';
import { SPREADSHEET_PLUGIN_ID, SPREADSHEET_NODE_TYPE } from '../../../../spreadsheet-plugin/src/common/constants.js';
import type { TabularDataApi } from '@hierarchidb/ui-tabular';
import type { TabularDatabaseManager } from '@hierarchidb/tabular-store';

export { SPREADSHEET_PLUGIN_ID, SPREADSHEET_NODE_TYPE };

export interface PluginTabularApiOptions {
  pluginId: string;
  metadataManager: TabularDatabaseManager;
  corsProxyBaseURL?: string;
  resolveCorsProxyBaseURL?: () => string | undefined;
  enableCorsProxy?: boolean;
}

export function createSpreadsheetTabularApi(pluginId: string = SPREADSHEET_PLUGIN_ID): TabularDataApi {
  return new SpreadsheetTabularApiDriver(pluginId) as TabularDataApi;
}

export function createPluginTabularApi(options: PluginTabularApiOptions): TabularDataApi {
  return new SpreadsheetTabularApiDriver(options.metadataManager, options.pluginId) as TabularDataApi;
}

export { SpreadsheetTabularApiDriver };
