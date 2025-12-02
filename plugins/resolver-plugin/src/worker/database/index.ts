import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { ResolverEntity } from '../../common/types/index.js';

/**
 * Resolver worker-side storage for resolver definitions and working copies.
 * Exposed via `@hierarchidb/resolver-plugin/database` so loaders can prewarm Dexie consistently.
 */
export class ResolverEntitiesDB extends Dexie {
  resolvers!: Table<ResolverEntity>;

  constructor() {
    super(getDBName('resolver-db'));
    this.version(1).stores({
      resolvers: '&id, nodeId, name',
    });
  }
}

export const resolverEntitiesDB = new ResolverEntitiesDB();

export { clearDatabases } from './clear.js';
