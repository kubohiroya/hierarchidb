import { getDBName } from '@hierarchidb/util';
import { EphemeralDB } from './EphemeralDB.js';

export class EphemeralShapeDB extends EphemeralDB {
  constructor(dbName: string = getDBName('shape-ephemeral')) {
    super(dbName);
  }
}

export const ephemeralShapeDB = new EphemeralShapeDB();
