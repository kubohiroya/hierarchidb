import { createPluginTabularApi } from '@hierarchidb/spreadsheet-plugin';
import type { TabularDataApi } from '@hierarchidb/ui-tabular';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { RouteTabularMetadataManager } from './RouteTabularMetadataManager.js';

const ROUTE_PLUGIN_ID = 'route';

export function createRouteTabularApi(): TabularDataApi {
  const metadataManager = new RouteTabularMetadataManager(
    getDBName(getBuildDatabasePrefix(), 'route-metadata')
  );
  return createPluginTabularApi({
    pluginId: ROUTE_PLUGIN_ID,
    metadataManager,
    downloadDatabaseName: getDBName(getBuildDatabasePrefix(), 'route-chunks'),
    rowStoreDatabaseName: getDBName(getBuildDatabasePrefix(), 'tabular-source-rowstore-db'),
    enableCorsProxy: true,
  });
}
