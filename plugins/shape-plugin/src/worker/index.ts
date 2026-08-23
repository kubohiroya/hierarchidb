import { getBuildDatabasePrefix } from '@hierarchidb/util';
import { initializeShapeWorkerDatabases } from './initializeShapeWorkerDatabases.js';

initializeShapeWorkerDatabases(getBuildDatabasePrefix());

export { shapeBuildAPI } from './api.js';
export {
  canonicalBuildAPI,
  canonicalBuildRuntimeAdapter,
  clearShapeBuildRuntimeTransientStatus,
  configureShapeCanonicalBuildRuntimeAdapter,
  setShapeBuildRuntimeInputSource,
  setShapeBuildRuntimeTransientStatus,
  shapeBuildExtensions,
} from './canonicalBuildAPI.js';
export type { RegisterShapeWorkerStoresOptions } from './factory/registerShapeWorkerStores.js';
export { registerShapeWorkerStores } from './factory/registerShapeWorkerStores.js';
export { ShapeWorkerPlugin } from './ShapeWorkerPlugin.js';
