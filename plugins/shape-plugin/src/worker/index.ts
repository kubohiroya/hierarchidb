import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { initializeShapeChunkStore } from '../services/utils/initializeShapeChunkStore.js';

initializeShapeChunkStore(getDBName(getBuildDatabasePrefix(), 'shape-chunks'));

export { shapeBuildAPI } from './api.js';
export { canonicalBuildAPI, shapeBuildExtensions } from './canonicalBuildAPI.js';
export type { RegisterShapeWorkerStoresOptions } from './factory/registerShapeWorkerStores.js';
export { registerShapeWorkerStores } from './factory/registerShapeWorkerStores.js';
export { ShapeWorkerPlugin } from './ShapeWorkerPlugin.js';
