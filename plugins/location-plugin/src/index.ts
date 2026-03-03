/**
 * Location Plugin Entry Point
 */

export { PLUGIN_MANIFEST as LocationPluginManifest } from './plugin-manifest.js';

export * from './common/types/index.js';
export type { LocationAttributionInfo } from './common/datasources/resolveLocationAttribution.js';
export { resolveLocationAttribution } from './common/datasources/resolveLocationAttribution.js';
export * as worker from './worker/index.js';

// Services entry (DB, build managers, download registry, etc.)
export * from './services/index.js';
