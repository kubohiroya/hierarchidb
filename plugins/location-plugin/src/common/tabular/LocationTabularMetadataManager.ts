import { TabularDatabaseManager } from '@hierarchidb/tabular-store';

export class LocationTabularMetadataManager extends TabularDatabaseManager {
  constructor(dbName: string) {
    super(dbName);
  }
}
