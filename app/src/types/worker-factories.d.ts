declare namespace HierarchidbWorkerFactories {
  type EntitiesDbModule = Record<string, unknown> | undefined;
}

declare module '@hierarchidb/basemap-plugin/worker-factory' {
  export function loadBasemapEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/folder-plugin/worker-factory' {
  export function loadFolderEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/linker-plugin/worker-factory' {
  export function loadLinkerEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/location-plugin/worker-factory' {
  export function loadLocationEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/resolver-plugin/worker-factory' {
  export function loadResolverEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/route-plugin/worker-factory' {
  export function loadRouteEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/shape-plugin/worker-factory' {
  export function loadShapeEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/spreadsheet-plugin/worker-factory' {
  export function loadSpreadsheetEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/styler-plugin/worker-factory' {
  export function loadStylerEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/timeline-plugin/worker-factory' {
  export function loadTimelineEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

export {};
