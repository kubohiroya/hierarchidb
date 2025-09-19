declare module 'virtual:plugin-registry-services' {
  export const pluginServices: {
    'base': () => Promise<typeof import('@hierarchidb/base-plugin')>;
    'basemap': () => Promise<typeof import('@hierarchidb/basemap-plugin/database')>;
    'folder': () => Promise<typeof import('@hierarchidb/folder-plugin/shared')>;
    'linker': () => Promise<typeof import('@hierarchidb/linker-plugin/services')>;
    'location': () => Promise<typeof import('@hierarchidb/location-plugin/services')>;
    'resolver': () => Promise<typeof import('@hierarchidb/resolver-plugin/database')>;
    'route': () => Promise<typeof import('@hierarchidb/route-plugin/database')>;
    'shape': () => Promise<typeof import('@hierarchidb/shape-plugin/services')>;
    'spreadsheet': () => Promise<typeof import('@hierarchidb/spreadsheet-plugin/database')>;
    'styler': () => Promise<typeof import('@hierarchidb/styler-plugin/services')>;
    'timeline': () => Promise<typeof import('@hierarchidb/timeline-plugin/services')>;
    [nodeType: string]: () => Promise<unknown>;
  };
}
