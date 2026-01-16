import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { FetchCacheRecord, TransformCacheRecord } from '../types.js';
import { vtShapeStoreSchema } from './schema.js';

export class VtShapeDb extends Dexie {
  fetchCache!: Table<FetchCacheRecord, string>;
  transformCache!: Table<TransformCacheRecord, string>;

  constructor(dbName: string = getDBName('vt-shape')) {
    super(dbName);
    this.version(3).stores(vtShapeStoreSchema);
    this.fetchCache = this.table('fetchCache');
    this.transformCache = this.table('transformCache');
  }
}
