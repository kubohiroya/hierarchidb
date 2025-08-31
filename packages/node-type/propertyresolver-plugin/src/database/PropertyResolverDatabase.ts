import Dexie, { type Table } from 'dexie';
import type { PropertyResolverEntity, PropertyResolverWorkingCopy } from '../types';

/**
 * PropertyResolver database for managing entity storage
 */
class PropertyResolverDatabase extends Dexie {
  propertyResolvers!: Table<PropertyResolverEntity>;
  workingCopies!: Table<PropertyResolverWorkingCopy>;

  constructor() {
    super('PropertyResolverDB');
    
    this.version(1).stores({
      propertyResolvers: '&id, nodeId, name, createdAt, updatedAt',
      workingCopies: '&id, nodeId, originalId, originalVersion',
    });
  }
}

// Create singleton instance
export const propertyResolverDB = new PropertyResolverDatabase();