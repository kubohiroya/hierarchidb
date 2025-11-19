declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module 'maplibre-gl/dist/maplibre-gl.css';

declare module '@hierarchidb/basemap-plugin/worker' {
  export type RegisterBasemapWorkerStoresOptions = Record<string, unknown>;

  export function registerBasemapWorkerStores(
    options?: RegisterBasemapWorkerStoresOptions
  ): Promise<void>;
}
