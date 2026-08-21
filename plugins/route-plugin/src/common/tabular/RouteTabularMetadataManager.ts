import { TabularDatabaseManager } from '@hierarchidb/tabular-store';

export class RouteTabularMetadataManager extends TabularDatabaseManager {
  constructor(dbName: string) {
    super(dbName);
  }
}
