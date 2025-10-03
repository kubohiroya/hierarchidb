type UnknownOptions = Record<string, unknown> | undefined;

declare module '@hierarchidb/plugins-basemap-plugin/worker-factory' {
  export type RegisterBasemapWorkerStoresOptions = UnknownOptions;
  export function registerBasemapWorkerStores(options?: RegisterBasemapWorkerStoresOptions): Promise<void>;
  export function loadBasemapEntitiesDbModule(): Promise<unknown>;
}

declare module '@hierarchidb/plugins-folder-plugin/worker-factory' {
  export type RegisterFolderWorkerStoresOptions = UnknownOptions;
  export function registerFolderWorkerStores(options?: RegisterFolderWorkerStoresOptions): Promise<void>;
  export function loadFolderEntitiesDbModule(): Promise<unknown>;
}

declare module '@hierarchidb/plugins-linker-plugin/worker-factory' {
  export type RegisterLinkerWorkerStoresOptions = UnknownOptions;
  export function registerLinkerWorkerStores(options?: RegisterLinkerWorkerStoresOptions): Promise<void>;
  export function loadLinkerEntitiesDbModule(): Promise<unknown>;
}

declare module '@hierarchidb/plugins-location-plugin/worker-factory' {
  export type RegisterLocationWorkerStoresOptions = UnknownOptions;
  export function registerLocationWorkerStores(options?: RegisterLocationWorkerStoresOptions): Promise<void>;
  export function loadLocationEntitiesDbModule(): Promise<unknown>;
}

declare module '@hierarchidb/plugins-resolver-plugin/worker-factory' {
  export type RegisterResolverWorkerStoresOptions = UnknownOptions;
  export function registerResolverWorkerStores(options?: RegisterResolverWorkerStoresOptions): Promise<void>;
  export function loadResolverEntitiesDbModule(): Promise<unknown>;
}

declare module '@hierarchidb/plugins-route-plugin/worker-factory' {
  export type RegisterRouteWorkerStoresOptions = UnknownOptions;
  export function registerRouteWorkerStores(options?: RegisterRouteWorkerStoresOptions): Promise<void>;
  export function loadRouteEntitiesDbModule(): Promise<unknown>;
}

declare module '@hierarchidb/plugins-shape-plugin/worker-factory' {
  export type RegisterShapeWorkerStoresOptions = UnknownOptions;
  export function registerShapeWorkerStores(options?: RegisterShapeWorkerStoresOptions): Promise<void>;
  export function loadShapeEntitiesDbModule(): Promise<unknown>;
}

declare module '@hierarchidb/plugins-spreadsheet-plugin/worker-factory' {
  export type RegisterSpreadsheetWorkerStoresOptions = UnknownOptions;
  export function registerSpreadsheetWorkerStores(options?: RegisterSpreadsheetWorkerStoresOptions): Promise<void>;
  export function loadSpreadsheetEntitiesDbModule(): Promise<unknown>;
}

declare module '@hierarchidb/plugins-styler-plugin/worker-factory' {
  export type RegisterStylerWorkerStoresOptions = UnknownOptions;
  export function registerStylerWorkerStores(options?: RegisterStylerWorkerStoresOptions): Promise<void>;
  export function loadStylerEntitiesDbModule(): Promise<unknown>;
}

declare module '@hierarchidb/plugins-timeline-plugin/worker-factory' {
  export type RegisterTimelineWorkerStoresOptions = UnknownOptions;
  export function registerTimelineWorkerStores(options?: RegisterTimelineWorkerStoresOptions): Promise<void>;
  export function loadTimelineEntitiesDbModule(): Promise<unknown>;
}
