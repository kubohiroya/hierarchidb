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
  const { LocationEntityHandler } = await import('../entities/LocationEntityHandler');
  // Handler may accept Dexie tables via later injection; construct bare for now
  return new LocationEntityHandler(undefined as any);
}

export async function createBatchManager() {
  const { createLocationBatchManager } = await import('../services/batch/UnifiedLocationBatchManager');
  return createLocationBatchManager();
}

export const lifecycle = {
  async onCreate(nodeId: any): Promise<void> {
    try { console.log(`[LocationPlugin] onCreate: ${nodeId}`); } catch {}
  },
} as const;

const mod = { register };
export default mod;
