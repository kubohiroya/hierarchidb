/**
 * Location Plugin Entry Point
 */

export { PLUGIN_MANIFEST as LocationPluginManifest } from './plugin-manifest.js';

export * from './common/types/index.js';
export * as worker from './worker/index.js';

// Services entry (DB, batch managers, download registry, etc.)
export * from './services/index.js';

// Unified Batch Control API (API v2)
export * from './services/batch/UnifiedLocationBatchManager.js';
