/// <reference types="vite/client" />

export interface RegisterShapeWorkerStoresOptions {
  signal?: AbortSignal;
}

export async function registerShapeWorkerStores(
  options: RegisterShapeWorkerStoresOptions = {}
): Promise<void> {
  if (options.signal?.aborted) return;
}

/*
export async function loadShapeEntitiesDbModule() {
  return import('../shapeEntitiesDB.js');
}
 */
