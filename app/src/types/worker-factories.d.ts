declare namespace HierarchidbWorkerFactories {
  type EntitiesDbModule = Record<string, unknown> | undefined;
}

declare module '@hierarchidb/plugins-basemap-plugin/worker-factory' {
  export function loadBasemapEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/plugins-folder-plugin/worker-factory' {
  export function loadFolderEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/plugins-linker-plugin/worker-factory' {
  export function loadLinkerEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/plugins-location-plugin/worker-factory' {
  export function loadLocationEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/plugins-resolver-plugin/worker-factory' {
  export function loadResolverEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/plugins-route-plugin/worker-factory' {
  export function loadRouteEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/plugins-shape-plugin/worker-factory' {
  export function loadShapeEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/plugins-spreadsheet-plugin/worker-factory' {
  export function loadSpreadsheetEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/plugins-styler-plugin/worker-factory' {
  export function loadStylerEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

declare module '@hierarchidb/plugins-timeline-plugin/worker-factory' {
  export function loadTimelineEntitiesDbModule(): Promise<HierarchidbWorkerFactories.EntitiesDbModule>;
}

export {};
