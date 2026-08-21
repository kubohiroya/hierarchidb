import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { initializeShapeChunkStore } from '../services/utils/initializeShapeChunkStore.js';

initializeShapeChunkStore(getDBName(getBuildDatabasePrefix(), 'shape-chunks'));

export { registerShapeWorkerStores } from './factory/registerShapeWorkerStores.js';
export type { RegisterShapeWorkerStoresOptions } from './factory/registerShapeWorkerStores.js';
export { shapeBuildAPI } from './api.js';
export { ShapeWorkerPlugin } from './ShapeWorkerPlugin.js';
