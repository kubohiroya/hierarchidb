/**
 * Shape Plugin - Common public API entry point
 * Exports shared types and manifest for app-level consumption.
 */

export { PLUGIN_MANIFEST as ShapePluginManifest } from '../plugin-manifest.js';
export * from './types/index.js';
export { ShapeMetadata } from './types/ShapeMetadata.js';
