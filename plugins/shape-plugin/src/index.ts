/**
  * Shape Plugin - Main entry point
 * 3
  */

//  Shared layer -
export * from './common/shared/index.js';

// UI layer is internal to app; not exported in package API

// Worker layer exports are internal; public API deferred until types are stabilized

// Extension exports (for plugin extension system)
// Extension (UI) exports omitted from public API for now

//  Backward compatibility -
export { ShapeMetadata } from './common/shared/metadata.js';
export { PLUGIN_MANIFEST as ShapePluginManifest } from './plugin-manifest.js';
export type { ShapeEntity, CreateShapeData, UpdateShapeData } from './common/shared/types.js';
export type { ShapeAPI } from './common/shared/api.js';

// Unified Batch Control API (API v2)
export * from './services/batch/UnifiedShapeBatchManager.js';
export { BatchSessionManager as ShapeBatchSessionManager } from './services/batch/BatchSessionManager.js';

// Batch processing exports are temporarily internal-only until type contracts are stabilized
// Export plugin definition for worker fallback loading
// Plugin definition export removed: metadata is sourced from package.json
export { TabularQueryService as ShapeTableQueryService } from '@hierarchidb/tabular-store';
export * from './services/tiles/RuntimeTileClient.js';

// Optional runtime wiring for shared bootstrap (no shared imports)
export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    try {
      const mod = await import('./services/batch/adapters/registerRuntimeWorker.js');
      await mod.registerShapeRuntimeWorkerAdapters();
    } catch {
      /* noop */
    }
  }
}
