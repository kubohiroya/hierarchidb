import { registerPluginRuntimeWorkerAdapters } from '@hierarchidb/runtime-worker';

/**
 * Registers a Comlink-based stage processing client backed by a Web Worker.
 * Consumers can call this at app startup to enable true multi-threaded execution.
 */
export async function registerShapeRuntimeWorkerAdapters(): Promise<void> {
  return registerPluginRuntimeWorkerAdapters({
    pluginId: 'shape',
    flagName: 'SHAPE_RUNTIME_WORKER',
    defaultEnabled: true,
    allowLocalWorker: true,
  });
}
