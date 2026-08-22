/// <reference types="vite/client" />

export interface RegisterLinkerWorkerStoresOptions {
  signal?: AbortSignal;
}

export async function registerLinkerWorkerStores(
  options: RegisterLinkerWorkerStoresOptions = {}
): Promise<void> {
  if (options.signal?.aborted) return;
  // No worker-side Dexie stores yet; keep as no-op for breadth rollout.
}

export async function loadLinkerEntitiesDbModule(): Promise<null> {
  return null;
}
