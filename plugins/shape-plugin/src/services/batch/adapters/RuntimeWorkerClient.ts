import {
  getRuntimeWorkerClient,
  registerRuntimeWorkerClient,
  type RuntimeWorkerClientProvider,
  type RuntimeWorkerStageClient,
} from '@hierarchidb/runtime-worker';

/**
 * TODO(shape-runtime-worker-worker-integration): ensure the shape plugin's
 * adapter tests exercise the shared factory path (both runtime-worker worker
 * and local client fallbacks) once end-to-end coverage is added.
 */

export type ShapeRuntimeWorkerClient = RuntimeWorkerStageClient;

export function registerShapeRuntimeWorkerClient(provider: RuntimeWorkerClientProvider): void {
  registerRuntimeWorkerClient('shape', provider);
}

export async function getShapeRuntimeWorkerClient(): Promise<ShapeRuntimeWorkerClient | null> {
  return getRuntimeWorkerClient('shape');
}
