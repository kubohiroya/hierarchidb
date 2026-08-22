import { createPluginTabularApi } from '@hierarchidb/spreadsheet-plugin';
import type { TabularDataApi } from '@hierarchidb/ui-tabular';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { LocationTabularMetadataManager } from './LocationTabularMetadataManager.js';

const LOCATION_PLUGIN_ID = 'location';

export function createLocationTabularApi(): TabularDataApi {
  const metadataManager = new LocationTabularMetadataManager(
    getDBName(getBuildDatabasePrefix(), 'location-metadata')
  );
  return createPluginTabularApi({
    pluginId: LOCATION_PLUGIN_ID,
    metadataManager,
    downloadDatabaseName: getDBName(getBuildDatabasePrefix(), 'location-chunks'),
    rowStoreDatabaseName: getDBName(getBuildDatabasePrefix(), 'tabular-source-rowstore-db'),
    enableCorsProxy: true,
  });
}
