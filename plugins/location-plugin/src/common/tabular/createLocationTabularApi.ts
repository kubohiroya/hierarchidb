import type { TabularDataApi } from '@hierarchidb/ui-tabular';
import { createPluginTabularApi } from '@hierarchidb/spreadsheet-plugin';
import { LocationTabularMetadataManager } from './LocationTabularMetadataManager.js';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';

const LOCATION_PLUGIN_ID = 'location';

export function createLocationTabularApi(): TabularDataApi {
  const metadataManager = new LocationTabularMetadataManager(
    getDBName(getBuildDatabasePrefix(), 'location-metadata')
  );
  return createPluginTabularApi({
    pluginId: LOCATION_PLUGIN_ID,
    metadataManager,
    downloadDatabaseName: getDBName(getBuildDatabasePrefix(), 'location-chunks'),
    enableCorsProxy: true,
  });
}
