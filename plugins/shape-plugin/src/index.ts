/**
  * Shape Plugin - Main entry point
 * 3
  */

//  Shared layer -
export * from './common/types/index.js';

// UI layer is internal to app; not exported in package API

// Worker layer exports are internal; public API deferred until types are stabilized

// Extension exports (for plugin extension system)
// Extension (UI) exports omitted from public API for now

//  Backward compatibility -
export { ShapeMetadata } from './common/types/metadata.js';
export { PLUGIN_MANIFEST as ShapePluginManifest } from './plugin-manifest.js';
//export type { CreateShapeData, UpdateShapeData, BuildTaskResultType, BuildTaskResult } from './common/types/index.js';

// Batch processing exports are temporarily internal-only until type contracts are stabilized
// Export plugin definition for worker fallback loading
// Plugin definition export removed: metadata is sourced from package.json

let initialized = false;

export async function onRegister(): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    const { ShapeDB } = await import('@hierarchidb/shape-store');
    const db = new ShapeDB();
    await db.open();
    await db.close();
  } catch (error) {
    console.warn('[shape-plugin] failed to pre-open ShapeDB:', error);
  }
}
