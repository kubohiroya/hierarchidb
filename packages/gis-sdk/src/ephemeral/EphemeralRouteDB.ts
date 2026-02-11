import { getDBName } from '@hierarchidb/util';
import { EphemeralDB } from './EphemeralDB.js';

export class EphemeralRouteDB extends EphemeralDB {
  constructor(dbName: string = getDBName('route-ephemeral')) {
    super(dbName);
  }
}

export const ephemeralRouteDB = new EphemeralRouteDB();
