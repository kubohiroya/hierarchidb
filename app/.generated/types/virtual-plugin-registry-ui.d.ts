declare module 'virtual:plugin-registry-ui' {
  export const pluginMapUI: {

    [nodeType: string]: () => Promise<unknown>;
  };
}
