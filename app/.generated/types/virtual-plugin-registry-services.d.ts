declare module 'virtual:plugin-registry-services' {
  export const pluginServices: {

    [nodeType: string]: () => Promise<unknown>;
  };
}
