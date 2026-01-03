import { getDBName } from '@hierarchidb/util';
import { TabularDatabaseManager } from '@hierarchidb/tabular-store/src/index';

export class RouteTabularMetadataManager extends TabularDatabaseManager {
  constructor(dbName: string = getDBName('route-metadata')) {
    super(dbName);
  }
}
