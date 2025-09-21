declare module 'virtual:plugin-registry-worker' {
  export const pluginMapWorker: {

    [nodeType: string]: () => Promise<unknown>;
  };
}
