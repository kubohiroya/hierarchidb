// Development-time type bridges so that packages using dynamic imports can obtain
// the original workspace types without introducing tsconfig path overrides.

declare module '@hierarchidb/runtime-worker' {
  export * from '../../runtime/worker/dist/index';
}

declare module '@hierarchidb/runtime-worker-bootstrap' {
  export * from '../../runtime/worker-bootstrap/src/index';
}

declare module '@hierarchidb/map-adapter' {
  export * from '../../feature/map-adapter/src/index';
}

declare module '@hierarchidb/tabular-xlsx' {
  export * from '../../feature/tabular-xlsx/src/index';
}

declare module '@hierarchidb/plugins-basemap-plugin/worker-factory' {
  export * from '../../plugins/basemap-plugin/dist/worker-factory/index';
}

declare module '@hierarchidb/plugins-folder-plugin/worker-factory' {
  export * from '../../plugins/folder-plugin/dist/worker-factory/index';
}

declare module '@hierarchidb/plugins-resolver-plugin/worker-factory' {
  export * from '../../plugins/resolver-plugin/dist/worker-factory/index';
}

declare module '@hierarchidb/plugins-route-plugin/worker-factory' {
  export * from '../../plugins/route-plugin/dist/worker-factory/index';
}

declare module '@hierarchidb/plugins-spreadsheet-plugin/worker-factory' {
  export * from '../../plugins/spreadsheet-plugin/dist/worker-factory/index';
}

declare module '@hierarchidb/plugins-styler-plugin/worker-factory' {
  export * from '../../plugins/styler-plugin/dist/worker-factory/index';
}

declare module '@hierarchidb/plugins-shape-plugin/worker-factory' {
  export * from '../../plugins/shape-plugin/dist/worker-factory/index';
}

declare module '@hierarchidb/plugins-location-plugin/worker-factory' {
  export * from '../../plugins/location-plugin/dist/worker-factory/index';
}

declare module '@hierarchidb/plugins-linker-plugin/worker-factory' {
  export * from '../../plugins/linker-plugin/dist/worker-factory/index';
}

declare module '@hierarchidb/plugins-timeline-plugin/worker-factory' {
  export * from '../../plugins/timeline-plugin/dist/worker-factory/index';
}
