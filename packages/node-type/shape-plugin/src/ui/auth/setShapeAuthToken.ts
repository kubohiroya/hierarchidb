/**
 * Sync auth token to the Shape plugin worker.
 * Safe to call when auth state changes; no-op if the worker extension
 * doesn't expose setAuthToken().
 */

// Optional dependency injection for app-provided Worker API getter
let getWorkerAPI: (() => any) | null = null;
export function injectWorkerAPIGetter(getter: () => any) {
  getWorkerAPI = getter;
}

export async function setShapeAuthToken(token: string, type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number): Promise<void> {
  if (!getWorkerAPI) return; // Not running within app environment
  const client = getWorkerAPI();
  if (!client) return;
  const workerAPI = client.getAPI();
  const registry = await workerAPI.getPluginRegistryAPI();
  const ext = await registry.getExtension('shape');
  if (ext && typeof (ext as any).setAuthToken === 'function') {
    await (ext as any).setAuthToken(token, type, expiresAt);
  }
}
