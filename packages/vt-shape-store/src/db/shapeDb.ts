import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { FetchCacheRecord, TransformByBandCacheRecord, TransformByZoomCacheRecord, TransformByZoomReservation } from '../types.js';
import { vtShapeStoreSchema } from './schema.js';

export class VtShapeDb extends Dexie {
  fetchCache!: Table<FetchCacheRecord, string>;
  transformByBandCache!: Table<TransformByBandCacheRecord, string>;
  transformByZoomCache!: Table<TransformByZoomCacheRecord, [string, number, number, string]>;
  transformByZoomReservations!: Table<TransformByZoomReservation, [string, number]>;

  constructor(dbName: string = getDBName('vt-shape')) {
    super(dbName);
    this.version(2).stores(vtShapeStoreSchema);
    this.fetchCache = this.table('fetchCache');
    this.transformByBandCache = this.table('transformByBandCache');
    this.transformByZoomCache = this.table('transformByZoomCache');
    this.transformByZoomReservations = this.table('transformByZoomReservations');
  }
}
