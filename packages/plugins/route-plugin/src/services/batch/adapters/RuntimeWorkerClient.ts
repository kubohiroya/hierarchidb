import {
  getRuntimeWorkerClient,
  registerRuntimeWorkerClient,
  type RuntimeWorkerClientProvider,
  type RuntimeWorkerStageClient,
} from '@hierarchidb/plugins-runtime-worker-factory';

/**
 * TODO(route-runtime-worker-integration): expand test coverage so that
 * batch session execution exercises the runtime-worker factory path
 * (real Comlink client when flag ON, local stage client when flag OFF).
 */

export type RouteRuntimeWorkerClient = RuntimeWorkerStageClient;

export function registerRouteRuntimeWorkerClient(provider: RuntimeWorkerClientProvider): void {
  registerRuntimeWorkerClient('route', provider);
}

export async function getRouteRuntimeWorkerClient(): Promise<RouteRuntimeWorkerClient | null> {
  return getRuntimeWorkerClient('route');
}
