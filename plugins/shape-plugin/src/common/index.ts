/**
 * Shape Plugin - Common public API entry point
 * Exports shared types and manifest for app-level consumption.
 */

export { PLUGIN_MANIFEST as ShapePluginManifest } from '../plugin-manifest.js';
export * from './types/BuildTaskResult.js';
export * from './types/ShapeEntity.js';
export * from './types/ShapeFeaturePayload.js';
export * from './types/VectorTileEntity.js';
export * from './types/apiTypes.js';
export * from './types/constants.js';
export * from './types/createUpdateTypes.js';
export * from './types/data-source.js';
export * from './types/validationTypes.js';
export * from '../services/utils/shapeBuildUtils.js';
export { ShapeMetadata } from './types/ShapeMetadata.js';
