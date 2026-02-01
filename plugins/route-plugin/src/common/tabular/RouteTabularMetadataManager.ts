import { getDBName } from '@hierarchidb/util';
import { TabularDatabaseManager } from '@hierarchidb/tabular-store';

export class RouteTabularMetadataManager extends TabularDatabaseManager {
  constructor(dbName: string = getDBName('route-metadata')) {
    super(dbName);
  }
}
