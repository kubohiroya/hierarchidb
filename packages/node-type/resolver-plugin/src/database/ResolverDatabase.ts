import Dexie, { type Table } from 'dexie';
import type { ResolverEntity, ResolverWorkingCopy } from '../types';

/**
 * Resolver database for managing entity storage
 */
class ResolverDatabase extends Dexie {
  resolvers!: Table<ResolverEntity>;
  workingCopies!: Table<ResolverWorkingCopy>;

  constructor() {
    super('ResolverDB');
    
    this.version(1).stores({
      resolvers: '&id, nodeId, name, createdAt, updatedAt',
      workingCopies: '&id, nodeId, originalId, originalVersion',
    });
  }
}

// Create singleton instance
export const resolverDB = new ResolverDatabase();