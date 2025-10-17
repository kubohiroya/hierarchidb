/**
 * Sync auth token to the Shape plugin worker.
 * Safe to call when auth state changes; no-op if the worker extension
 * doesn't expose setAuthToken().
 */

import type { WorkerClientHook } from '@hierarchidb/runtime-client';

interface PluginRegistryFacade {
  getExtension<T = unknown>(nodeType: string): Promise<T | undefined>;
}

interface WorkerClientFacade {
  getPluginRegistryAPI(): Promise<PluginRegistryFacade>;
}

interface WorkerClientWithAPI {
  getAPI(): WorkerClientFacade;
}

interface ShapeAuthExtension {
  setAuthToken(token: string, type?: 'Bearer' | 'Basic', expiresAt?: number): Promise<void> | void;
}

const isShapeAuthExtension = (extension: unknown): extension is ShapeAuthExtension => {
  return typeof extension === 'object' && extension !== null &&
    typeof (extension as ShapeAuthExtension).setAuthToken === 'function';
};

// Optional dependency injection for app-provided Worker API getter
let getWorkerAPI: WorkerClientHook<WorkerClientWithAPI> | null = null;
export function injectWorkerAPIGetter(getter: WorkerClientHook<WorkerClientWithAPI>) {
  getWorkerAPI = getter;
}

export async function setShapeAuthToken(token: string, type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number): Promise<void> {
  if (!getWorkerAPI) return; // Not running within app environment
  const client = getWorkerAPI();
  if (!client) return;
  const workerAPI = client.getAPI();
  const registry = await workerAPI.getPluginRegistryAPI();
  const extension = await registry.getExtension('shape');
  if (isShapeAuthExtension(extension)) {
    await extension.setAuthToken(token, type, expiresAt);
  }
}
