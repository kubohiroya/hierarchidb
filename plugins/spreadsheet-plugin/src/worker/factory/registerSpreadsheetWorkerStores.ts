/// <reference types="vite/client" />

export interface RegisterSpreadsheetWorkerStoresOptions {
  signal?: AbortSignal;
}

export async function registerSpreadsheetWorkerStores(
  options: RegisterSpreadsheetWorkerStoresOptions = {}
): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }
}
