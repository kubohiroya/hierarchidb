// Re-export worker API types so they remain part of the public surface
export type { DownloadWorkerAPI, SimplifyWorkerAPI, VectorTileWorkerAPI } from '@hierarchidb/runtime-worker';

import {
  getRuntimeWorkerClient,
  registerRuntimeWorkerClient,
  type RuntimeWorkerClientProvider,
  type RuntimeWorkerStageClient,
} from '@hierarchidb/plugin-api';

/**
 * TODO(shape-runtime-worker-integration): ensure the shape plugin's
 * adapter tests exercise the shared factory path (both runtime worker
 * and local client fallbacks) once end-to-end coverage is added.
 */

export type ShapeRuntimeWorkerClient = RuntimeWorkerStageClient;

export function registerShapeRuntimeWorkerClient(provider: RuntimeWorkerClientProvider): void {
  registerRuntimeWorkerClient('shape', provider);
}

export async function getShapeRuntimeWorkerClient(): Promise<ShapeRuntimeWorkerClient | null> {
  return getRuntimeWorkerClient('shape');
}
