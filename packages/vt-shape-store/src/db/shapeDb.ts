import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { Band3Reservation, Stage1Buffer, TileIndexRow, TransformBuffer } from '../types.js';
import { vtShapeStoreSchema } from './schema.js';

export class VtShapeDb extends Dexie {
  stage1Buffers!: Table<Stage1Buffer, string>;
  transformBandBuffers!: Table<TransformBuffer, string>;
  tileIndexBand!: Table<TileIndexRow, [string, number, number, string]>;
  vtBand3Reservations!: Table<Band3Reservation, [string, number]>;

  constructor(dbName: string = getDBName('vt-shape')) {
    super(dbName);
    this.version(1).stores(vtShapeStoreSchema);
    this.stage1Buffers = this.table('stage1Buffers');
    this.transformBandBuffers = this.table('transformBandBuffers');
    this.tileIndexBand = this.table('tileIndexBand');
    this.vtBand3Reservations = this.table('vtBand3Reservations');
  }
}
