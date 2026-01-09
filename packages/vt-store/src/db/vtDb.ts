import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { VtTileRecord } from '../types.js';
import { vtStoreSchema } from './schema.js';

export class VtDb extends Dexie {
  vtTiles!: Table<VtTileRecord, string>;

  constructor(dbName: string = getDBName('vt')) {
    super(dbName);
    this.version(1).stores(vtStoreSchema);
    this.vtTiles = this.table('vtTiles');
  }
}
