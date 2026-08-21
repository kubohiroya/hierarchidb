export * from '@hierarchidb/route-api';
export type { RouteTileIndexRecord, RouteVectorTileRecord } from './RouteDB.js';
export {
  clearRouteDatabases,
  clearRouteDatabases as clearDatabases,
  closeRouteDB,
  countRouteReferencesToLocations,
  getRouteDB,
  hasRouteReferencesToLocations,
  initializeRouteDB,
  RouteDB,
} from './RouteDB.js';
export type { RouteDatabaseHandle } from './routeDbTypes.js';
