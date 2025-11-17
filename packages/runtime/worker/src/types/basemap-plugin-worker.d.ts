declare module '@hierarchidb/basemap-plugin/worker' {
  export type RegisterBasemapWorkerStoresOptions = Record<string, unknown>;

  export function registerBasemapWorkerStores(
    options?: RegisterBasemapWorkerStoresOptions
  ): Promise<void>;
}
