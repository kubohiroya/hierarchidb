import type { TabularDataApi } from '@hierarchidb/ui-tabular';
import { createPluginTabularApi } from '@hierarchidb/spreadsheet-plugin';
import { LocationTabularMetadataManager } from './LocationTabularMetadataManager.js';

const LOCATION_PLUGIN_ID = 'location';

export function createLocationTabularApi(): TabularDataApi {
  const metadataManager = new LocationTabularMetadataManager();
  return createPluginTabularApi({
    pluginId: LOCATION_PLUGIN_ID,
    metadataManager,
    enableCorsProxy: true,
  });
}
