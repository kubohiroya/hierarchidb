import {
  getRuntimeWorkerClient,
  registerRuntimeWorkerClient,
  type RuntimeWorkerClientProvider,
  type RuntimeWorkerStageClient,
} from '@hierarchidb/plugins-runtime-worker-factory';

export type LocationRuntimeWorkerClient = RuntimeWorkerStageClient;

export function registerLocationRuntimeWorkerClient(provider: RuntimeWorkerClientProvider): void {
  registerRuntimeWorkerClient('location', provider);
}

export async function getLocationRuntimeWorkerClient(): Promise<LocationRuntimeWorkerClient | null> {
  return getRuntimeWorkerClient('location');
}
