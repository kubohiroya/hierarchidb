/**
 * Location Plugin - Common public API entry point
 * Exports shared types, datasource utilities, and manifest for app-level consumption.
 */

export { PLUGIN_MANIFEST as LocationPluginManifest } from '../plugin-manifest.js';
export type { LocationAttributionInfo } from './datasources/resolveLocationAttribution.js';
export { resolveLocationAttribution } from './datasources/resolveLocationAttribution.js';
export * from './types/index.js';
