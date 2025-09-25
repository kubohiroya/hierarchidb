/// <reference types="vite/client" />

export interface RegisterTimelineWorkerStoresOptions {
  // Placeholder for future registry injection; kept for API parity
  storeRegistry?: unknown;
  signal?: AbortSignal;
}

export async function registerTimelineWorkerStores(options: RegisterTimelineWorkerStoresOptions = {}): Promise<void> {
  if (options.signal?.aborted) return;
  // No-op for now. Timeline plugin does not maintain worker-side stores yet.
}

export async function loadTimelineEntitiesDbModule() { return null as any; }

// Side-effect for API parity with other plugins (does nothing)
registerTimelineWorkerStores().catch(() => {});
