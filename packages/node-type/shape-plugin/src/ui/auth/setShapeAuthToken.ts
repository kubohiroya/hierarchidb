/**
 * Sync auth token to the Shape plugin worker.
 * Safe to call when auth state changes; no-op if the worker extension
 * doesn't expose setAuthToken().
 */

// Lazy import to avoid hard dependency in non-app contexts
let getWorkerAPI: (() => any) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@hierarchidb/app/src/hooks/useWorkerAPIClient');
  getWorkerAPI = mod?.getWorkerAPIClient ?? mod?.useWorkerAPIClient; // support either export shape
} catch {}

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

