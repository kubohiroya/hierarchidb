/// <reference types="vite/client" />

export interface RegisterFolderWorkerStoresOptions {
  storeRegistry?: unknown;
  signal?: AbortSignal;
}

/**
 * Folder plugin currently has no worker-side Dexie stores.
 * Keep a no-op registration hook for consistency with other plugins.
 */
export async function registerFolderWorkerStores(
  options: RegisterFolderWorkerStoresOptions = {}
): Promise<void> {
  if (options.signal?.aborted) return;
  // No folder-specific worker stores to register.
}

// Ensure side-effect import works in older call sites.
registerFolderWorkerStores().catch(() => {});
