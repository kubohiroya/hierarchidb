/// <reference types="vite/client" />

export interface RegisterLocationWorkerStoresOptions {
  signal?: AbortSignal;
}

export async function registerLocationWorkerStores(options: RegisterLocationWorkerStoresOptions = {}): Promise<void> {
  if (options.signal?.aborted) return;
}

type LocationEntitiesDbModule = typeof import('../locationEntitiesDB.js');

export async function loadLocationEntitiesDbModule(): Promise<LocationEntitiesDbModule | null> {
  try {
    return await import('~/worker/locationEntitiesDB');
  } catch {
    return null;
  }
}
