/**
 * Worker-safe entry for project-plugin
 * - No DOM/MUI imports
 * - Dexie-based stores/utilities may be imported here as needed
 */

export function register(): void {
  // No-op for now. Wire project worker handlers here when available.
}

const mod = { register };
export default mod;

