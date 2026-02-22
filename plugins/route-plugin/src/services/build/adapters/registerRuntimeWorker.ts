/**
 * @file registerRuntimeWorker.ts
 * @description Scaffolding for runtime-worker worker registration (features-flagged, no-op safe) for Route plugin
 */

import { getStageProcessingClient } from '@hierarchidb/runtime-worker';
import {
  registerPluginRuntimeWorkerAdapters,
} from '@hierarchidb/runtime-worker';
import { registerRouteRuntimeWorkerClient } from './RuntimeWorkerClient.js';

/**
 * Register Route plugin stage adapters backed by a Web Worker.
 * - Guarded by `ROUTE_RUNTIME_WORKER` (default: off)
 * - Safe to call even if runtime-worker-worker package is unavailable
 */
export async function registerRouteRuntimeWorkerAdapters(): Promise<void> {
  registerRouteRuntimeWorkerClient(async () => getStageProcessingClient());
  return registerPluginRuntimeWorkerAdapters({
    pluginId: 'route',
    flagName: 'ROUTE_RUNTIME_WORKER',
  });
}
