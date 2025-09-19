declare module 'virtual:plugin-registry-services' {
  export const pluginServices: {
    'base': () => Promise<typeof import('@hierarchidb/node-type-base-plugin')>;
    'basemap': () => Promise<typeof import('@hierarchidb/node-type-basemap-plugin/database')>;
    'folder': () => Promise<typeof import('@hierarchidb/node-type-folder-plugin/shared')>;
    'linker': () => Promise<typeof import('@hierarchidb/node-type-linker-plugin/services')>;
    'location': () => Promise<typeof import('@hierarchidb/node-type-location-plugin/services')>;
    'resolver': () => Promise<typeof import('@hierarchidb/node-type-resolver-plugin/database')>;
    'route': () => Promise<typeof import('@hierarchidb/node-type-route-plugin/database')>;
    'shape': () => Promise<typeof import('@hierarchidb/node-type-shape-plugin/services')>;
    'spreadsheet': () => Promise<typeof import('@hierarchidb/node-type-spreadsheet-plugin/database')>;
    'styler': () => Promise<typeof import('@hierarchidb/node-type-styler-plugin/services')>;
    'timeline': () => Promise<typeof import('@hierarchidb/node-type-timeline-plugin/services')>;
    [nodeType: string]: () => Promise<unknown>;
  };
}
