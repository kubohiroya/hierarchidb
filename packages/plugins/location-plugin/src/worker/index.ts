/**
 * Worker-safe entry for location-plugin
 * - No DOM/MUI imports
 * - Dexie-based stores/utilities may be imported here as needed
 * - Provides standardized worker exports (factory + lifecycle)
 */

export function register(): void {
  // No-op wiring placeholder (kept for backward compatibility)
}

// Standardized worker-side factory exports (polymorphic contract)
export async function createEntityHandler() {
  const { LocationEntityHandler } = await import('../entities/LocationEntityHandler.js');
  return new LocationEntityHandler();
}

export async function createBatchManager() {
  const { createLocationBatchManager } = await import('../services/batch/UnifiedLocationBatchManager.js');
  return createLocationBatchManager();
}

export class Lifecycle {
  static async onCreate(nodeId: any): Promise<void> {
    console.log(`[LocationPlugin] onCreate: ${nodeId}`);
  }
}

const mod = { register };
export default mod;
