import type { TabularDatabaseManager } from '@hierarchidb/tabular-store';
import type { TabularDataApi } from '@hierarchidb/ui-tabular';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import {
  SPREADSHEET_NODE_TYPE,
  SPREADSHEET_PLUGIN_ID,
} from '../../../../spreadsheet-plugin/src/common/constants.js';
import { SpreadsheetTabularApiDriver } from '../../../../spreadsheet-plugin/src/services/SpreadsheetTabularApiDriver.js';

export { SPREADSHEET_PLUGIN_ID, SPREADSHEET_NODE_TYPE };

export interface PluginTabularApiOptions {
  pluginId: string;
  metadataManager: TabularDatabaseManager;
  downloadDatabaseName: string;
  rowStoreDatabaseName: string;
  corsProxyBaseURL?: string;
  resolveCorsProxyBaseURL?: () => string | undefined;
  enableCorsProxy?: boolean;
}

export function createSpreadsheetTabularApi(
  pluginId: string = SPREADSHEET_PLUGIN_ID
): TabularDataApi {
  return new SpreadsheetTabularApiDriver(
    pluginId,
    undefined,
    getDBName(getBuildDatabasePrefix(), 'spreadsheet-chunks'),
    getDBName(getBuildDatabasePrefix(), 'tabular-source-rowstore-db'),
    getDBName(getBuildDatabasePrefix(), 'spreadsheet-metadata')
  ) as TabularDataApi;
}

export function createPluginTabularApi(options: PluginTabularApiOptions): TabularDataApi {
  return new SpreadsheetTabularApiDriver(
    options.metadataManager,
    options.pluginId,
    options.downloadDatabaseName,
    options.rowStoreDatabaseName
  ) as TabularDataApi;
}

export { SpreadsheetTabularApiDriver };
