import {
  getRuntimeWorkerClient,
  registerRuntimeWorkerClient,
  type RuntimeWorkerClientProvider,
  type RuntimeWorkerStageClient,
} from '@hierarchidb/runtime-worker';

export type RouteRuntimeWorkerClient = RuntimeWorkerStageClient;

export function registerRouteRuntimeWorkerClient(provider: RuntimeWorkerClientProvider): void {
  registerRuntimeWorkerClient('route', provider);
}

export async function getRouteRuntimeWorkerClient(): Promise<RouteRuntimeWorkerClient | null> {
  return getRuntimeWorkerClient('route');
}

