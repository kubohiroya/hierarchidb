// Development-time type bridges so that packages using dynamic imports can obtain
// the original workspace types without introducing tsconfig path overrides.

declare module '@hierarchidb/runtime-worker' {
  export * from '../../runtime/worker/dist/index';
  import runtimeWorker from '../../runtime/worker/dist/index';
  export default runtimeWorker;
}

declare module '@hierarchidb/runtime-worker-bootstrap' {
  export * from '../../runtime/worker-bootstrap/dist/index';
  import runtimeWorkerBootstrap from '../../runtime/worker-bootstrap/dist/index';
  export default runtimeWorkerBootstrap;
}

declare module '@hierarchidb/map-adapter' {
  export * from '../../feature/map-adapter/dist/index';
  import mapAdapter from '../../feature/map-adapter/dist/index';
  export default mapAdapter;
}

declare module '@hierarchidb/tabular-xlsx' {
  export * from '../../feature/tabular-xlsx/dist/index';
  import tabularXlsx from '../../feature/tabular-xlsx/dist/index';
  export default tabularXlsx;
}

declare module '@hierarchidb/plugins-basemap-plugin/worker-factory' {
  export * from '../../plugins/basemap-plugin/dist/worker-factory/index';
  import basemapWorker from '../../plugins/basemap-plugin/dist/worker-factory/index';
  export default basemapWorker;
}

declare module '@hierarchidb/plugins-folder-plugin/worker-factory' {
  export * from '../../plugins/folder-plugin/dist/worker-factory/index';
  import folderWorker from '../../plugins/folder-plugin/dist/worker-factory/index';
  export default folderWorker;
}

declare module '@hierarchidb/plugins-resolver-plugin/worker-factory' {
  export * from '../../plugins/resolver-plugin/dist/worker-factory/index';
  import resolverWorker from '../../plugins/resolver-plugin/dist/worker-factory/index';
  export default resolverWorker;
}

declare module '@hierarchidb/plugins-route-plugin/worker-factory' {
  export * from '../../plugins/route-plugin/dist/worker-factory/index';
  import routeWorker from '../../plugins/route-plugin/dist/worker-factory/index';
  export default routeWorker;
}

declare module '@hierarchidb/plugins-spreadsheet-plugin/worker-factory' {
  export * from '../../plugins/spreadsheet-plugin/dist/worker-factory/index';
  import spreadsheetWorker from '../../plugins/spreadsheet-plugin/dist/worker-factory/index';
  export default spreadsheetWorker;
}

declare module '@hierarchidb/plugins-styler-plugin/worker-factory' {
  export * from '../../plugins/styler-plugin/dist/worker-factory/index';
  import stylerWorker from '../../plugins/styler-plugin/dist/worker-factory/index';
  export default stylerWorker;
}

declare module '@hierarchidb/plugins-shape-plugin/worker-factory' {
  export * from '../../plugins/shape-plugin/dist/worker-factory/index';
  import shapeWorker from '../../plugins/shape-plugin/dist/worker-factory/index';
  export default shapeWorker;
}

declare module '@hierarchidb/plugins-location-plugin/worker-factory' {
  export * from '../../plugins/location-plugin/dist/worker-factory/index';
  import locationWorker from '../../plugins/location-plugin/dist/worker-factory/index';
  export default locationWorker;
}

declare module '@hierarchidb/plugins-linker-plugin/worker-factory' {
  export * from '../../plugins/linker-plugin/dist/worker-factory/index';
  import linkerWorker from '../../plugins/linker-plugin/dist/worker-factory/index';
  export default linkerWorker;
}

declare module '@hierarchidb/plugins-timeline-plugin/worker-factory' {
  export * from '../../plugins/timeline-plugin/dist/worker-factory/index';
  import timelineWorker from '../../plugins/timeline-plugin/dist/worker-factory/index';
  export default timelineWorker;
}
