import { registerShapeRuntimeWorkerClient } from './RuntimeWorkerClient.js';
import { createStageWorkerClient } from '@hierarchidb/runtime-worker';

/**
 * Registers a Comlink-based stage processing client backed by a Web Worker.
 * Consumers can call this at app startup to enable true multi-threaded execution.
 */
export function registerShapeRuntimeWorkerAdapters(): void {
  registerShapeRuntimeWorkerClient(async () => {
    try {
      return await createStageWorkerClient();
    } catch {
      return null;
    }
  });
}

