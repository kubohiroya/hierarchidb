/**
 * Location Plugin - Common public API entry point
 * Exports shared types, datasource utilities, and manifest for app-level consumption.
 */

export { PLUGIN_MANIFEST as LocationPluginManifest } from '../plugin-manifest.js';
export type { BuildLocationVectorLayersArgs } from './buildLocationVectorLayers.js';
export { buildLocationVectorLayers } from './buildLocationVectorLayers.js';
export type { LocationAttributionInfo } from './datasources/resolveLocationAttribution.js';
export { resolveLocationAttribution } from './datasources/resolveLocationAttribution.js';
export type {
  BuildLocationMvtStyleExpressionsArgs,
  LocationMvtStyleExpressions,
} from './locationMvtStyleExpressions.js';
export {
  buildLocationMvtStyleExpressions,
  LOCATION_MVT_CIRCLE_LAYER_ID,
  LOCATION_MVT_ICON_LAYER_ID,
  LOCATION_MVT_LABEL_LAYER_ID,
  LOCATION_MVT_PROMOTE_ID,
  LOCATION_MVT_SOURCE_LAYER,
} from './locationMvtStyleExpressions.js';
export * from './entities/LocationEntity.js';
export * from './entities/LocationPoint.js';
