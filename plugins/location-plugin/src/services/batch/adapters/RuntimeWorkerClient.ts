import {
  getRuntimeWorkerClient,
  registerRuntimeWorkerClient,
  type RuntimeWorkerClientProvider,
  type RuntimeWorkerStageClient,
} from '@hierarchidb/plugin-api';

/**
 * TODO(location-runtime-worker-integration): consider adding a local
 * smoke test that ensures getLocationRuntimeWorkerClient returns a
 * runner configured via registerLocationRuntimeWorkerAdapters when the
 * LOCATION_RUNTIME_WORKER flag is enabled. This will replace the manual
 * verification currently required after factory unification.
 */

export type LocationRuntimeWorkerClient = RuntimeWorkerStageClient;

export function registerLocationRuntimeWorkerClient(provider: RuntimeWorkerClientProvider): void {
  registerRuntimeWorkerClient('location', provider);
}

export async function getLocationRuntimeWorkerClient(): Promise<LocationRuntimeWorkerClient | null> {
  return getRuntimeWorkerClient('location');
}
