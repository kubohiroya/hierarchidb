import { SimpleTableMetadataManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

export class RouteTabularMetadataManager extends SimpleTableMetadataManager {
  constructor(dbName: string = getDBName('route-tabular-metadata-db')) {
    super(dbName);
  }
}
