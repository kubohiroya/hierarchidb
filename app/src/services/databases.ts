import { loadPluginService } from './plugin-services';

export async function getBaseMapDatabase() {
  const mod = await loadPluginService('basemap');
  if (!mod) return null;
  const { BaseMapDatabase } = mod as typeof import('@hierarchidb/basemap-plugin/database');
  return new BaseMapDatabase();
}

export async function getResolverDB() {
  const mod = await loadPluginService('resolver');
  if (!mod) return null;
  const { resolverDB } = mod as typeof import('@hierarchidb/resolver-plugin/database');
  return resolverDB;
}

export async function getSpreadsheetDatabase() {
  const mod = await loadPluginService('spreadsheet');
  if (!mod) return null;
  const { SpreadsheetDatabase } = mod as typeof import('@hierarchidb/spreadsheet-plugin/database');
  return new SpreadsheetDatabase();
}

export async function getRouteDatabase() {
  const mod = await loadPluginService('route');
  if (!mod) return null;
  const { RouteDatabase } = mod as typeof import('@hierarchidb/route-plugin/database');
  return new RouteDatabase();
}

export async function getShapeDatabase() {
  const mod = await loadPluginService('shape');
  if (!mod) return null;
  const { ShapeDB } = mod as typeof import('@hierarchidb/shape-plugin/services');
  return new ShapeDB();
}

export async function getLocationEphemeralDB() {
  const mod = await loadPluginService('location');
  if (!mod) return null;
  const { getEphemeralLocationDB } = mod as typeof import('@hierarchidb/location-plugin/services');
  return getEphemeralLocationDB();
}
