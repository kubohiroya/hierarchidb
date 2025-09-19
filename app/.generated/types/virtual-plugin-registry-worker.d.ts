declare module 'virtual:plugin-registry-worker' {
  export const pluginMapWorker: {
    'base': () => Promise<unknown>;
    'basemap': () => Promise<unknown>;
    'folder': () => Promise<unknown>;
    'linker': () => Promise<unknown>;
    'location': () => Promise<unknown>;
    'resolver': () => Promise<unknown>;
    'route': () => Promise<unknown>;
    'shape': () => Promise<unknown>;
    'spreadsheet': () => Promise<unknown>;
    'styler': () => Promise<unknown>;
    'timeline': () => Promise<unknown>;
    [nodeType: string]: () => Promise<unknown>;
  };
}
