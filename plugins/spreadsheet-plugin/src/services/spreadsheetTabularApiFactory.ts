import type { TabularDataApi } from '@hierarchidb/ui-tabular';
import { SpreadsheetTabularApiDriver } from './SpreadsheetTabularApiDriver.js';
import { SPREADSHEET_PLUGIN_ID } from '../common/constants.js';

export function createSpreadsheetTabularApi(pluginId: string = SPREADSHEET_PLUGIN_ID): TabularDataApi {
  return new SpreadsheetTabularApiDriver(pluginId);
}
