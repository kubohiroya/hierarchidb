/**
 * @file registerRuntimeWorker.ts
 * @description Scaffolding for runtime-worker worker registration (features-flagged, no-op safe)
 */

import { registerPluginRuntimeWorkerAdapters } from '@hierarchidb/runtime-worker';

/**
 * Register Location plugin stage adapters backed by a Web Worker.
 * - Guarded by `LOCATION_RUNTIME_WORKER` (default: off)
 * - Safe to call even if runtime-worker-worker package is unavailable
 */
export async function registerLocationRuntimeWorkerAdapters(): Promise<void> {
  return registerPluginRuntimeWorkerAdapters({
    pluginId: 'location',
    flagName: 'LOCATION_RUNTIME_WORKER',
  });
}
