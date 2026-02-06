export * from '@hierarchidb/route-api';
export type { RouteDatabaseHandle } from './routeDbTypes.js';
export type { RouteTileIndexRecord, RouteVectorTileRecord } from './RouteDB.js';
export {
  RouteDB,
  getRouteDB,
  closeRouteDB,
  clearRouteDatabases,
  hasRouteReferencesToLocations,
  countRouteReferencesToLocations,
  clearRouteDatabases as clearDatabases,
} from './RouteDB.js';
