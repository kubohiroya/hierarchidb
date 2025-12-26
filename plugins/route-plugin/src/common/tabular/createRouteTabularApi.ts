import type { TabularDataApi } from '@hierarchidb/ui-tabular';
import { createPluginTabularApi } from '@hierarchidb/spreadsheet-plugin';
import { RouteTabularMetadataManager } from './RouteTabularMetadataManager.js';

const ROUTE_PLUGIN_ID = 'route';

export function createRouteTabularApi(): TabularDataApi {
  const metadataManager = new RouteTabularMetadataManager();
  return createPluginTabularApi({
    pluginId: ROUTE_PLUGIN_ID,
    metadataManager,
    enableCorsProxy: true,
  });
}
