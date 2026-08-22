import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import { initializeShapeDB } from '@hierarchidb/shape-store';
import { getDBName } from '@hierarchidb/util';
import { initializeShapeChunkStore } from '../services/utils/initializeShapeChunkStore.js';

export const initializeShapeWorkerDatabases = (databasePrefix: string): void => {
  initializeEphemeralDB(getDBName(databasePrefix, 'ephemeral'));
  initializeShapeDB(getDBName(databasePrefix, 'shape'));
  initializeShapeChunkStore(getDBName(databasePrefix, 'shape-chunks'));
};
