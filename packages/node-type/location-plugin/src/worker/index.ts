/**
 * Worker-safe entry for location-plugin
 * - No DOM/MUI imports
 * - Dexie-based stores/utilities may be imported here as needed
 */

export function register(): void {
  // No-op for now. When location worker handlers are ready, wire them here.
}

const mod = { register };
export default mod;

