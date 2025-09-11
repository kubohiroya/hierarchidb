/**
  * Shape Plugin - Main entry point
 * 3
  */

//  Shared layer -
export * from './shared';

// UI layer is internal to app; not exported in package API

// Worker layer exports are internal; public API deferred until types are stabilized

// Extension exports (for plugin extension system)
// Extension (UI) exports omitted from public API for now

//  Backward compatibility -
export { ShapeMetadata } from './shared/metadata';
export type { ShapeEntity, CreateShapeData, UpdateShapeData } from './shared/types';
export type { ShapeAPI } from './shared/api';

// Unified Batch Control API (API v2)
export * from './services/batch/UnifiedShapeBatchManager';
export { BatchSessionManager as ShapeBatchSessionManager } from './services/batch/BatchSessionManager';

// Batch processing exports are temporarily internal-only until type contracts are stabilized
// Export plugin definition for worker fallback loading
export { ShapePluginDefinition } from './definitions/ShapePluginDefinition';
export { TabularQueryService as ShapeTableQueryService } from '@hierarchidb/tabular-store';
export * from './services/tiles/RuntimeTileClient';

// Optional runtime wiring for shared bootstrap (no shared imports)
export const runtimeWiring = {
  registerRuntimeWorkerAdapters: async () => {
    try {
      const mod = await import('./services/batch/adapters/registerRuntimeWorker');
      await mod.registerShapeRuntimeWorkerAdapters();
    } catch { /* noop */ }
  },
} as const;

// Folder dialog extension (optional): expose initializer so hosts can register evaluateSteps/steps
export { initializeShapeFolderExtension, shapeFolderExtension } from './extensions/ShapeFolderExtension';
