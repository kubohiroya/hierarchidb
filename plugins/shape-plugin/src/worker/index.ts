import { getBuildDatabasePrefix } from '@hierarchidb/util';
import { initializeShapeWorkerDatabases } from './initializeShapeWorkerDatabases.js';

initializeShapeWorkerDatabases(getBuildDatabasePrefix());

export { shapeBuildAPI } from './api.js';
export { canonicalBuildAPI, shapeBuildExtensions } from './canonicalBuildAPI.js';
export type { RegisterShapeWorkerStoresOptions } from './factory/registerShapeWorkerStores.js';
export { registerShapeWorkerStores } from './factory/registerShapeWorkerStores.js';
export { ShapeWorkerPlugin } from './ShapeWorkerPlugin.js';
