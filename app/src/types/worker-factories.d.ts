declare namespace HierarchidbWorkerFactories {
  type EntitiesDbModule = Record<string, unknown> | undefined;
}

declare module '@hierarchidb/basemap-plugin/worker' {
  export function loadBasemapEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/folder-plugin/worker' {
  export function loadFolderEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/linker-plugin/worker' {
  export function loadLinkerEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/location-plugin/worker' {
  export function loadLocationEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/resolver-plugin/worker' {
  export function loadResolverEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/route-plugin/worker' {
  export function loadRouteEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/shape-plugin/worker' {
  export function loadShapeEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/spreadsheet-plugin/worker' {
  export function loadSpreadsheetEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/styler-plugin/worker' {
  export function loadStylerEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/timeline-plugin/worker' {
  export function loadTimelineEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

export {};
