import { SimpleTableMetadataManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

export class LocationTabularMetadataManager extends SimpleTableMetadataManager {
  constructor(dbName: string = getDBName('location-tabular-metadata-db')) {
    super(dbName);
  }
}
