import type { TabularDataApi } from '@hierarchidb/ui-tabular';
import { createPluginTabularApi } from '@hierarchidb/spreadsheet-plugin';
import { RouteTabularMetadataManager } from './RouteTabularMetadataManager.js';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';

const ROUTE_PLUGIN_ID = 'route';

export function createRouteTabularApi(): TabularDataApi {
  const metadataManager = new RouteTabularMetadataManager(
    getDBName(getBuildDatabasePrefix(), 'route-metadata')
  );
  return createPluginTabularApi({
    pluginId: ROUTE_PLUGIN_ID,
    metadataManager,
    downloadDatabaseName: getDBName(getBuildDatabasePrefix(), 'route-chunks'),
    enableCorsProxy: true,
  });
}
