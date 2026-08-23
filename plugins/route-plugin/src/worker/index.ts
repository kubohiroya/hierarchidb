import { getRouteDB, initializeRouteDB } from '@hierarchidb/route-store';
import { getVTStoreRegistry } from '@hierarchidb/runtime-worker';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { createRouteVectorTileStoreDexie } from './createRouteVectorTileStoreDexie.js';

export {
  canonicalBuildAPI,
  canonicalBuildRuntimeAdapter,
  configureRouteCanonicalBuildInputResolver,
} from './canonicalBuildAPI.js';
export { getBuildTasks } from './getBuildTasks.js';

export const registerRouteWorkerStores = async (): Promise<void> => {
  const db = resolveRouteDB();
  await db.open?.();
  getVTStoreRegistry().registerVectorTiles('route', createRouteVectorTileStoreDexie(db));
};

const resolveRouteDB = (): ReturnType<typeof getRouteDB> => {
  try {
    return getRouteDB();
  } catch {
    return initializeRouteDB(getDBName(getBuildDatabasePrefix(), 'route'));
  }
};

export default registerRouteWorkerStores;
