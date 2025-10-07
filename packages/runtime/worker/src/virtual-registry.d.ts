// Virtual registry module provided by the app's Vite build.
declare module 'virtual:plugin-registry-worker' {
  export const pluginMapWorker: Record<string, () => Promise<unknown>>;
}
