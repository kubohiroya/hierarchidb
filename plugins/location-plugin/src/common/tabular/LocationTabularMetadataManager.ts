import { TabularDatabaseManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

export class LocationTabularMetadataManager extends TabularDatabaseManager {
  constructor(dbName: string = getDBName('location-metadata')) {
    super(dbName);
  }
}
